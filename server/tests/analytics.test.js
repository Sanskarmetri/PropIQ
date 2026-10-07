import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import request from 'supertest';
import {
  app,
  connectDatabase,
  disconnectDatabase,
  HistoricalPrice,
  mongoServer,
  Property,
  User,
} from './support/app.js';

const { ANALYTICS_LIMITS, parseAnalyticsFilters } = await import('../services/analyticsService.js');

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const accounts = {
  admin: { name: 'PropIQ Admin', email: 'admin@example.com', password: 'Str0ng-PropIQ-Password', role: 'admin' },
  seller: { name: 'Diya Menon', email: 'seller@example.com', password: 'Str0ng-PropIQ-Password', role: 'seller' },
  buyer: { name: 'Aarav Sharma', email: 'buyer@example.com', password: 'Str0ng-PropIQ-Password', role: 'buyer' },
};

const sessions = {};

/**
 * Registers the account, promotes it where the role is not buyer, then signs in
 * so the analytics routes see a real token.
 */
const signIn = async (account) => {
  if (sessions[account.email]) return sessions[account.email];

  const registration = await request(app).post('/api/auth/register').send(account);
  assert.equal(registration.status, 201, JSON.stringify(registration.body));

  if (account.role !== 'buyer') {
    await User.updateOne({ email: account.email }, { $set: { role: account.role } });
  }

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: account.email, password: account.password });
  assert.equal(login.status, 200);

  sessions[account.email] = login.body.data.token;
  return sessions[account.email];
};

const asAdmin = async () => signIn(accounts.admin);
const asSeller = async () => signIn(accounts.seller);
const asBuyer = async () => signIn(accounts.buyer);

const owner = { _id: undefined };

// Two benchmark rates keep every price figure in these tests exact:
//   Indiranagar 2,000 sq.ft.  -> ₹2,80,00,000 estimate
//   Whitefield   1,000 sq.ft.  -> ₹50,00,000   estimate
const INDIRANAGAR_RATE = 14000;
const WHITEFIELD_RATE = 5000;

const seedBenchmark = (overrides = {}) =>
  HistoricalPrice.create({
    locality: 'Indiranagar',
    city: 'Bengaluru',
    propertyType: 'apartment',
    averagePricePerSqFt: INDIRANAGAR_RATE,
    sampleSize: 20,
    source: 'development-sample',
    period: '2025-sample',
    ...overrides,
  });

const listingInput = (overrides = {}) => ({
  title: 'Sunlit Courtyard Residence',
  description: 'A calm, light-filled apartment.',
  locality: 'Indiranagar',
  city: 'Bengaluru',
  propertyType: 'apartment',
  builtUpArea: 2000,
  bedrooms: 3,
  bathrooms: 2,
  propertyAge: 1,
  amenities: [],
  askingPrice: 28000000,
  ...overrides,
});

const createListing = (overrides = {}) => Property.create(listingInput({ owner: owner._id, ...overrides }));

/**
 * Rewrites a listing's creation timestamp. The raw collection driver is used
 * because Mongoose re-stamps `createdAt` on every update, which would make the
 * trend and date-range assertions untestable.
 */
const setCreatedAt = (property, isoDate) =>
  Property.collection.updateOne({ _id: property._id }, { $set: { createdAt: new Date(isoDate) } });

const getOverview = (token, query = '') =>
  request(app)
    .get(`/api/analytics/overview${query}`)
    .set('Authorization', `Bearer ${token}`);

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                   */
/* -------------------------------------------------------------------------- */

before(async () => {
  const connected = await connectDatabase();
  assert.equal(connected, true, 'tests need a working MongoDB connection');
  owner._id = (await User.create({
    name: 'Listing Owner',
    email: 'owner@example.com',
    password: 'Str0ng-PropIQ-Password',
    role: 'seller',
  }))._id;
});

after(async () => {
  await connectDatabase();
  await disconnectDatabase();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([HistoricalPrice.deleteMany({}), Property.deleteMany({})]);
});

/* -------------------------------------------------------------------------- */
/* 1. Authorization                                                            */
/* -------------------------------------------------------------------------- */

test('analytics are refused without a session', async () => {
  const response = await request(app).get('/api/analytics/overview');

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, 'AUTH_REQUIRED');
});

test('analytics are refused for a seller and a buyer', async () => {
  for (const session of [await asSeller(), await asBuyer()]) {
    const response = await getOverview(session);

    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'INSUFFICIENT_ROLE');
    assert.equal(response.body.data, undefined);
  }
});

test('every analytics route is admin only', async () => {
  for (const path of ['/overview', '/report', '/filters']) {
    const anonymous = await request(app).get(`/api/analytics${path}`);
    assert.equal(anonymous.status, 401, `${path} should require a session`);

    const seller = await request(app).get(`/api/analytics${path}`).set('Authorization', `Bearer ${await asSeller()}`);
    assert.equal(seller.status, 403, `${path} should require the admin role`);
  }
});

test('an invalid session is rejected', async () => {
  const response = await getOverview('not-a-real-token');

  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'INVALID_TOKEN');
});

/* -------------------------------------------------------------------------- */
/* 2. KPI accuracy                                                             */
/* -------------------------------------------------------------------------- */

test('KPIs are computed from the stored listings', async () => {
  await Promise.all([
    createListing({ title: 'Indiranagar Calm 3BHK', askingPrice: 28000000, builtUpArea: 2000 }),
    createListing({ title: 'Indiranagar Bright 2BHK', askingPrice: 14000000, builtUpArea: 1000, bedrooms: 2 }),
    createListing({ title: 'Indiranagar Garden Villa', propertyType: 'villa', askingPrice: 42000000, builtUpArea: 2800 }),
    createListing({ title: 'Bandra West Sea Breeze', city: 'Mumbai', askingPrice: 31000000, builtUpArea: 1250, status: 'sold' }),
    createListing({ title: 'Pune Kothrud Studio', city: 'Pune', askingPrice: 6000000, builtUpArea: 700, status: 'inactive' }),
  ]);

  const { body } = await getOverview(await asAdmin());
  const { kpis, breakdowns, dataCoverage } = body.data;

  assert.equal(body.success, true);
  assert.equal(kpis.totalListings, 5);
  assert.equal(kpis.activeListings, 3);
  assert.equal(kpis.soldListings, 1);
  assert.equal(kpis.inactiveListings, 1);
  assert.equal(kpis.activeSharePercentage, 60);

  // 2.80 Cr + 1.40 Cr + 4.20 Cr + 3.10 Cr + 0.60 Cr = 12.10 Cr over 5 listings
  assert.equal(kpis.averageAskingPrice, 24200000);
  assert.equal(kpis.medianAskingPrice, 28000000);
  assert.equal(kpis.minimumAskingPrice, 6000000);
  assert.equal(kpis.maximumAskingPrice, 42000000);

  // 14,000 + 14,000 + 15,000 + 24,800 + 8,571.43 over 5 listings
  assert.equal(kpis.averagePricePerSqFt, 15274);
  assert.equal(kpis.totalAskingValue, 121000000);
  assert.equal(kpis.activeAskingValue, 84000000);
  assert.equal(kpis.empty, false);

  assert.equal(breakdowns.status.byStatus.active, 3);
  assert.equal(breakdowns.status.byStatus.sold, 1);
  assert.equal(breakdowns.status.byStatus.inactive, 1);

  const cities = Object.fromEntries(breakdowns.cities.map((row) => [row.city, row.listings]));
  assert.deepEqual(cities, { Bengaluru: 3, Mumbai: 1, Pune: 1 });

  const types = Object.fromEntries(breakdowns.propertyTypes.map((row) => [row.propertyType, row.listings]));
  assert.deepEqual(types, { apartment: 4, villa: 1 });

  const leading = breakdowns.cities[0];
  assert.equal(leading.city, 'Bengaluru');
  assert.equal(leading.sharePercentage, 60);

  assert.equal(dataCoverage.totalListingsInDatabase, 5);
  assert.equal(dataCoverage.matchedListings, 5);
  assert.ok(Date.parse(dataCoverage.firstListingAt) <= Date.parse(dataCoverage.lastListingAt));
});

test('status, type, city and locality shares always add up to the listing count', async () => {
  await Promise.all([
    createListing({ title: 'Indiranagar One', askingPrice: 10000000 }),
    createListing({ title: 'Whitefield Two', locality: 'Whitefield', askingPrice: 7500000, status: 'sold' }),
    createListing({ title: 'Koramangala Three', locality: 'Koramangala', askingPrice: 6900000, propertyType: 'villa' }),
  ]);

  const { body } = await getOverview(await asAdmin());
  const { breakdowns, kpis } = body.data;

  for (const row of breakdowns.status.breakdown) {
    assert.equal(Math.round((row.sharePercentage / 100) * kpis.totalListings), row.listings);
  }
  for (const row of breakdowns.propertyTypes) {
    assert.equal(Math.round((row.sharePercentage / 100) * kpis.totalListings), row.listings);
  }
  for (const row of breakdowns.cities) {
    assert.equal(Math.round((row.sharePercentage / 100) * kpis.totalListings), row.listings);
  }
  for (const row of breakdowns.localities) {
    assert.equal(Math.round((row.sharePercentage / 100) * kpis.totalListings), row.listings);
    assert.ok(row.locality && row.city);
  }
});

/* -------------------------------------------------------------------------- */
/* 3. Filters                                                                  */
/* -------------------------------------------------------------------------- */

test('a city filter narrows every figure to that city', async () => {
  await Promise.all([
    createListing({ title: 'Bengaluru One', city: 'Bengaluru' }),
    createListing({ title: 'Bengaluru Two', city: 'Bengaluru', askingPrice: 21000000 }),
    createListing({ title: 'Mumbai One', city: 'Mumbai', locality: 'Bandra West' }),
  ]);

  const { body } = await getOverview(await asAdmin(), '?city=Bengaluru');

  assert.equal(body.data.kpis.totalListings, 2);
  assert.equal(body.data.kpis.averageAskingPrice, 24500000);
  assert.equal(body.data.filters.city, 'Bengaluru');
  assert.equal(body.data.filters.hasAnyFilter, true);
  assert.equal(body.data.dataCoverage.totalListingsInDatabase, 3);
  assert.deepEqual(body.data.breakdowns.cities.map((row) => row.city), ['Bengaluru']);
});

test('locality, property type and status filters combine', async () => {
  await Promise.all([
    createListing({ title: 'Indiranagar Active Flat', askingPrice: 28000000 }),
    createListing({ title: 'Indiranagar Sold Flat', askingPrice: 30000000, status: 'sold' }),
    createListing({ title: 'Whitefield Active Flat', locality: 'Whitefield', askingPrice: 7500000 }),
    createListing({ title: 'Indiranagar Active Villa', propertyType: 'villa', askingPrice: 42000000 }),
  ]);

  const { body } = await getOverview(
    await asAdmin(),
    '?locality=Indiranagar&propertyType=apartment&status=active',
  );

  assert.equal(body.data.kpis.totalListings, 1);
  assert.equal(body.data.kpis.averageAskingPrice, 28000000);
  assert.equal(body.data.breakdowns.status.breakdown.length, 1);
  assert.equal(body.data.breakdowns.status.breakdown[0].status, 'active');
  assert.equal(body.data.filters.locality, 'Indiranagar');
  assert.equal(body.data.filters.propertyType, 'apartment');
  assert.equal(body.data.filters.status, 'active');
});

test('city and locality matching ignores case but not spelling', async () => {
  await Promise.all([
    createListing({ title: 'Indiranagar One' }),
    createListing({ title: 'Whitefield One', locality: 'Whitefield' }),
  ]);

  const lowered = await getOverview(await asAdmin(), '?locality=whitefield');
  assert.equal(lowered.body.data.kpis.totalListings, 1);

  const misspelled = await getOverview(await asAdmin(), '?locality=Whitefeild');
  assert.equal(misspelled.body.data.kpis.totalListings, 0);
  assert.equal(misspelled.body.data.kpis.empty, true);
});

test('a date range filters on the real createdAt timestamp', async () => {
  const older = await createListing({ title: 'Older Listing', askingPrice: 10000000 });
  const newer = await createListing({ title: 'Newer Listing', askingPrice: 20000000 });

  const olderDate = new Date('2024-01-15T09:00:00.000Z');
  const newerDate = new Date('2024-06-20T09:00:00.000Z');
  await setCreatedAt(older, olderDate);
  await setCreatedAt(newer, newerDate);

  const inRange = await getOverview(await asAdmin(), '?from=2024-01-01&to=2024-03-31');
  assert.equal(inRange.body.data.kpis.totalListings, 1);
  assert.equal(inRange.body.data.kpis.averageAskingPrice, 10000000);
  assert.equal(inRange.body.data.filters.from, '2024-01-01T00:00:00.000Z');
  assert.equal(inRange.body.data.filters.to, '2024-03-31T23:59:59.999Z');
  assert.equal(inRange.body.data.filters.timeZone, 'UTC');

  // The end of the range is inclusive of the whole final day.
  const onLastDay = await getOverview(await asAdmin(), '?from=2024-06-20&to=2024-06-20');
  assert.equal(onLastDay.body.data.kpis.totalListings, 1);
  assert.equal(onLastDay.body.data.kpis.averageAskingPrice, 20000000);

  const outsideRange = await getOverview(await asAdmin(), '?from=2025-01-01');
  assert.equal(outsideRange.body.data.kpis.totalListings, 0);
});

test('malformed filters are rejected with details', async () => {
  const token = await asAdmin();
  const cases = [
    { query: '?propertyType=castle', field: 'propertyType' },
    { query: '?status=archived', field: 'status' },
    { query: '?from=not-a-date', field: 'from' },
    { query: '?to=2024-13-45', field: 'to' },
    { query: '?from=2024-06-01&to=2024-01-01', field: 'to' },
  ];

  for (const { query, field } of cases) {
    const response = await getOverview(token, query);

    assert.equal(response.status, 400, `${query} should be rejected`);
    assert.equal(response.body.code, 'INVALID_ANALYTICS_FILTER');
    assert.ok(response.body.details[field], `${query} should explain ${field}`);
    assert.equal(response.body.data, undefined);
  }
});

test('a repeated filter is rejected instead of being coerced', async () => {
  const response = await getOverview(await asAdmin(), '?city=Bengaluru&city=Mumbai');

  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'INVALID_ANALYTICS_FILTER');
  assert.ok(response.body.details.city);
});

test('filter parsing drops blank values and rejects an unknown status', () => {
  const filters = parseAnalyticsFilters({ city: '  Bengaluru  ', locality: '', status: undefined });

  assert.equal(filters.city, 'Bengaluru');
  assert.equal(filters.locality, null);
  assert.equal(filters.hasFilters, true);

  const empty = parseAnalyticsFilters({});
  assert.equal(empty.hasFilters, false);
  assert.equal(empty.applied.from, null);

  assert.throws(() => parseAnalyticsFilters({ status: 'archived' }), (error) => error.code === 'INVALID_ANALYTICS_FILTER');
  assert.throws(() => parseAnalyticsFilters({ city: ['a', 'b'] }), (error) => error.code === 'INVALID_ANALYTICS_FILTER');
  assert.throws(() => parseAnalyticsFilters({ city: 'B'.repeat(200) }), (error) => error.code === 'INVALID_ANALYTICS_FILTER');
});

/* -------------------------------------------------------------------------- */
/* 4. Trend                                                                    */
/* -------------------------------------------------------------------------- */

test('the trend is grouped by the real creation month with no invented months', async () => {
  const listings = [
    ['January One', '2024-01-08T10:00:00.000Z', 10000000],
    ['January Two', '2024-01-21T10:00:00.000Z', 20000000],
    ['March One', '2024-03-04T10:00:00.000Z', 30000000],
    ['April One', '2024-04-11T10:00:00.000Z', 40000000],
  ];

  for (const [title, createdAt, askingPrice] of listings) {
    const property = await createListing({ title, askingPrice });
    await setCreatedAt(property, createdAt);
  }

  const { body } = await getOverview(await asAdmin());

  assert.deepEqual(body.data.trend.months.map((month) => month.month), ['2024-01', '2024-03', '2024-04']);
  assert.deepEqual(body.data.trend.months.map((month) => month.listings), [2, 1, 1]);
  assert.equal(body.data.trend.months[0].averageAskingPrice, 15000000);
  assert.equal(body.data.trend.availableMonths, 3);
  assert.equal(body.data.trend.capped, false);
  assert.match(body.data.trend.note, /gaps are real gaps/);
  // February is genuinely absent because nothing was created then.
  assert.equal(body.data.trend.months.some((month) => month.month === '2024-02'), false);
});

test('the trend honours the active filters', async () => {
  const bengaluru = await createListing({ title: 'Bengaluru One', city: 'Bengaluru' });
  const mumbai = await createListing({ title: 'Mumbai One', city: 'Mumbai' });
  await setCreatedAt(bengaluru, '2024-02-02T00:00:00.000Z');
  await setCreatedAt(mumbai, '2024-05-02T00:00:00.000Z');

  const { body } = await getOverview(await asAdmin(), '?city=Mumbai');

  assert.deepEqual(body.data.trend.months.map((month) => month.month), ['2024-05']);
});

/* -------------------------------------------------------------------------- */
/* 5. Screening coverage                                                       */
/* -------------------------------------------------------------------------- */

test('screening reuses the fraud service and reports its counts', async () => {
  await seedBenchmark();
  await seedBenchmark({ locality: 'Whitefield', averagePricePerSqFt: WHITEFIELD_RATE });

  // Asking price equals the estimate, and the two Indiranagar listings differ
  // enough in size, rooms and price to stay below the duplicate threshold.
  await createListing({ title: 'Fair Market Flat', askingPrice: 28000000, builtUpArea: 2000, bedrooms: 3 });
  await createListing({
    title: 'Overpriced Flat',
    askingPrice: 40000000,
    builtUpArea: 900,
    bedrooms: 1,
    bathrooms: 1,
    propertyAge: 0,
  });
  // A city with no benchmark row at all, so pricing screening cannot run.
  await createListing({ title: 'No Benchmark Flat', city: 'Chennai', locality: 'Adyar', askingPrice: 9000000 });

  const { body } = await getOverview(await asAdmin());
  const { screening } = body.data;

  assert.equal(screening.screenedListings, 3);
  assert.equal(screening.coverage.matchedListings, 3);
  assert.equal(screening.coverage.capped, false);
  assert.equal(screening.byStatus.clear, 1);
  assert.equal(screening.byStatus.elevated, 1);
  assert.equal(screening.byStatus.unavailable, 1);
  assert.equal(screening.withoutBenchmark, 1);
  assert.equal(screening.ruleTriggers.PRICE_DEVIATION, 1);
  assert.equal(screening.ruleTriggers.DUPLICATE_LISTING, 0);
  assert.equal(screening.errors, 0);

  const flagged = screening.flaggedListings.map((listing) => listing.title);
  assert.deepEqual(flagged, ['Overpriced Flat']);
  assert.equal(screening.flaggedListings[0].screening.riskLevel, 'high');
  assert.equal(screening.flaggedListings[0].screening.status, 'elevated');
  assert.ok(!('owner' in screening.flaggedListings[0]), 'flagged listings must not expose the owner');
  assert.ok(screening.flaggedListings[0].id, 'a flagged listing still carries an id so it can be opened');
});

test('a duplicate pair is counted by the same rule the screening endpoint uses', async () => {
  await seedBenchmark();

  await createListing({
    title: 'Duplicate Source Residence',
    builtUpArea: 1840,
    bedrooms: 3,
    bathrooms: 3,
    propertyAge: 4,
    askingPrice: 24500000,
  });
  await createListing({
    title: 'Duplicate Copy Residence',
    builtUpArea: 1850,
    bedrooms: 3,
    bathrooms: 3,
    propertyAge: 4,
    askingPrice: 24600000,
  });

  const { body } = await getOverview(await asAdmin());

  assert.equal(body.data.screening.ruleTriggers.DUPLICATE_LISTING, 2);
  assert.equal(body.data.screening.byStatus.elevated, 2);
  assert.equal(body.data.screening.flaggedListings.length, 2);
});

test('screening coverage is bounded and says so', async () => {
  await seedBenchmark();
  const many = Math.min(ANALYTICS_LIMITS.screeningLimit + 2, 8);
  for (let index = 0; index < many; index += 1) {
    await createListing({ title: `Bulk Listing ${index}`, askingPrice: 28000000, builtUpArea: 2000 + index });
  }

  // Shrink the limit for this assertion so the test does not need 50 listings.
  const originalLimit = ANALYTICS_LIMITS.screeningLimit;
  ANALYTICS_LIMITS.screeningLimit = 3;
  try {
    const { body } = await getOverview(await asAdmin());
    assert.equal(body.data.screening.coverage.screenedListings, 3);
    assert.equal(body.data.screening.coverage.matchedListings, many);
    assert.equal(body.data.screening.coverage.capped, true);
    assert.match(body.data.screening.note, /bounded/);
  } finally {
    ANALYTICS_LIMITS.screeningLimit = originalLimit;
  }
});

/* -------------------------------------------------------------------------- */
/* 6. Empty data                                                               */
/* -------------------------------------------------------------------------- */

test('an empty database returns honest zeros instead of invented values', async () => {
  const { body } = await getOverview(await asAdmin());
  const { kpis, breakdowns, trend, screening } = body.data;

  assert.equal(body.status, undefined);
  assert.equal(kpis.totalListings, 0);
  assert.equal(kpis.empty, true);
  assert.equal(kpis.averageAskingPrice, null);
  assert.equal(kpis.medianAskingPrice, null);
  assert.equal(kpis.averagePricePerSqFt, null);
  assert.equal(kpis.minimumAskingPrice, null);
  assert.equal(kpis.activeSharePercentage, null);
  assert.equal(kpis.totalAskingValue, 0);

  assert.deepEqual(breakdowns.cities, []);
  assert.deepEqual(breakdowns.localities, []);
  assert.deepEqual(breakdowns.propertyTypes, []);
  assert.deepEqual(trend.months, []);
  assert.equal(screening.screenedListings, 0);
  assert.deepEqual(screening.flaggedListings, []);
  assert.match(screening.note, /nothing to screen/);
  assert.equal(body.data.dataCoverage.firstListingAt, null);
});

test('a filter that matches nothing is reported as empty, not as an error', async () => {
  await createListing({ city: 'Bengaluru' });

  const { body } = await getOverview(await asAdmin(), '?city=Chennai');

  assert.equal(body.status, undefined);
  assert.equal(body.success, true);
  assert.equal(body.data.kpis.empty, true);
  assert.equal(body.data.kpis.totalListings, 0);
  assert.deepEqual(body.data.breakdowns.status.breakdown, []);
});

/* -------------------------------------------------------------------------- */
/* 7. Report and filter options                                                */
/* -------------------------------------------------------------------------- */

test('the report restates the same figures as the overview', async () => {
  await seedBenchmark();
  await Promise.all([
    createListing({ title: 'Indiranagar One', askingPrice: 28000000 }),
    createListing({ title: 'Indiranagar Two', askingPrice: 14000000, builtUpArea: 1000 }),
    createListing({ title: 'Bandra Three', city: 'Mumbai', locality: 'Bandra West', askingPrice: 31000000 }),
  ]);

  const token = await asAdmin();
  const overview = (await getOverview(token)).body.data;
  const report = (await request(app).get('/api/analytics/report').set('Authorization', `Bearer ${token}`)).body.data;

  assert.equal(report.title, 'PropIQ listing analytics report');
  assert.equal(report.summary.totalListings, overview.kpis.totalListings);
  assert.equal(report.summary.averageAskingPrice, overview.kpis.averageAskingPrice);
  assert.equal(report.summary.medianAskingPrice, overview.kpis.medianAskingPrice);
  assert.equal(report.scope.matchedListings, overview.kpis.totalListings);
  assert.ok(report.findings.length > 0);
  assert.ok(report.findings.every((finding) => typeof finding === 'string' && finding.length > 0));
  assert.ok(report.sections.some((section) => section.id === 'screening'));
  assert.ok(report.limitations.includes(
    'Asking prices are seller-set figures. PropIQ has no closed-transaction data, so nothing here is a realised sale price.',
  ));

  // The report is filtered by exactly the same rules as the overview.
  const filteredReport = (
    await request(app).get('/api/analytics/report?city=Mumbai').set('Authorization', `Bearer ${token}`)
  ).body.data;
  assert.equal(filteredReport.summary.totalListings, 1);
  assert.equal(filteredReport.filters.city, 'Mumbai');
});

test('the report states plainly when nothing matches', async () => {
  const report = (
    await request(app).get('/api/analytics/report?city=Chennai').set('Authorization', `Bearer ${await asAdmin()}`)
  ).body.data;

  assert.equal(report.summary.empty, true);
  assert.match(report.findings[0], /No listings match the current filters/);
});

test('filter options are read from the database', async () => {
  await Promise.all([
    createListing({ title: 'Indiranagar One', city: 'Bengaluru' }),
    createListing({ title: 'Whitefield One', locality: 'Whitefield', city: 'Bengaluru' }),
    createListing({ title: 'Whitefield Two', locality: 'Whitefield', city: 'Bengaluru' }),
    createListing({ title: 'Bandra One', locality: 'Bandra West', city: 'Mumbai' }),
  ]);

  const { body } = await request(app)
    .get('/api/analytics/filters')
    .set('Authorization', `Bearer ${await asAdmin()}`);

  assert.deepEqual(body.data.cities, [
    { name: 'Bengaluru', listings: 3 },
    { name: 'Mumbai', listings: 1 },
  ]);
  assert.deepEqual(body.data.localities[0], { name: 'Whitefield', city: 'Bengaluru', listings: 2 });
  assert.deepEqual(body.data.propertyTypes, ['apartment', 'villa', 'house', 'plot']);
  assert.deepEqual(body.data.statuses, ['active', 'sold', 'inactive']);
  assert.ok(Date.parse(body.data.dateRange.firstListingAt) <= Date.parse(body.data.dateRange.lastListingAt));
  assert.equal(body.data.limits.screeningLimit, ANALYTICS_LIMITS.screeningLimit);
});

test('filter options on an empty database return empty collections', async () => {
  const { body } = await request(app)
    .get('/api/analytics/filters')
    .set('Authorization', `Bearer ${await asAdmin()}`);

  assert.deepEqual(body.data.cities, []);
  assert.deepEqual(body.data.localities, []);
  assert.equal(body.data.dateRange.firstListingAt, null);
  assert.equal(body.data.dateRange.lastListingAt, null);
});

/* -------------------------------------------------------------------------- */
/* 8. Determinism                                                              */
/* -------------------------------------------------------------------------- */

test('repeated requests over the same data return identical figures', async () => {
  await seedBenchmark();
  await Promise.all([
    createListing({ title: 'Indiranagar One', askingPrice: 28000000 }),
    createListing({ title: 'Whitefield One', locality: 'Whitefield', askingPrice: 7500000 }),
  ]);

  const token = await asAdmin();
  const first = await getOverview(token, '?city=Bengaluru');
  const second = await getOverview(token, '?city=Bengaluru');

  assert.equal(first.body.data.kpis.totalListings, second.body.data.kpis.totalListings);
  assert.equal(first.body.data.kpis.averageAskingPrice, second.body.data.kpis.averageAskingPrice);
  assert.equal(first.body.data.kpis.medianAskingPrice, second.body.data.kpis.medianAskingPrice);
  assert.deepEqual(first.body.data.breakdowns, second.body.data.breakdowns);
  assert.deepEqual(first.body.data.screening.byStatus, second.body.data.screening.byStatus);
  assert.deepEqual(first.body.data.screening.flaggedListings, second.body.data.screening.flaggedListings);
  assert.ok(Number.isFinite(Date.parse(first.body.data.generatedAt)));
  assert.ok(Number.isFinite(Date.parse(second.body.data.generatedAt)));
});
