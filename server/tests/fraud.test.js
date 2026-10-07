import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import mongoose from 'mongoose';
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

// Imported dynamically for the same reason as the valuation suite: `support/app.js`
// sets the test environment after a top-level await.
const { FRAUD_MODEL, PRICE_DEVIATION, DUPLICATE_MATCHING, RISK_LEVELS } = await import('../config/fraudConfig.js');
const { analyzeProperty, evaluatePriceDeviation, screenStoredProperty } = await import(
  '../services/fraudService.js'
);
const { findSimilarListings, scoreCandidate } = await import('../services/duplicateDetectionService.js');
const { valueStoredProperty } = await import('../services/valuationService.js');

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

// A single benchmark: ₹14,000/sq.ft. for Indiranagar apartments.
// 2,000 sq.ft. therefore produces a ₹2,80,00,000 estimate, which makes every
// deviation threshold in these tests easy to state exactly. The fixture keeps a
// new build with no amenities so the amenity and age adjustments are both zero.
const BENCHMARK_RATE = 14000;
const BASE_ESTIMATE = 28000000;

const seedBenchmark = (overrides = {}) =>
  HistoricalPrice.create({
    locality: 'Indiranagar',
    city: 'Bengaluru',
    propertyType: 'apartment',
    averagePricePerSqFt: BENCHMARK_RATE,
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
  askingPrice: BASE_ESTIMATE,
  owner: undefined,
  ...overrides,
});

let ownerCount = 0;
const createOwner = (overrides = {}) =>
  User.create({
    name: 'Diya Menon',
    email: `seller-${(ownerCount += 1)}@example.com`,
    password: 'Str0ng-PropIQ-Password',
    role: 'seller',
    ...overrides,
  });

const createListing = async (overrides = {}) => {
  const owner = overrides.owner ?? (await createOwner());
  return Property.create(listingInput({ owner: owner._id, ...overrides }));
};

const postCheck = (body) => request(app).post('/api/fraud/check').send(body);

const priceFlag = (screening) => screening.flags.find((flag) => flag.type === 'PRICE_DEVIATION');
const duplicateFlag = (screening) => screening.flags.find((flag) => flag.type === 'DUPLICATE_LISTING');

/** Recursively collects every key path in a payload, for leakage assertions. */
const collectKeys = (value, prefix = '', keys = []) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, `${prefix}[]`, keys));
    return keys;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      keys.push(prefix ? `${prefix}.${key}` : key);
      collectKeys(child, prefix ? `${prefix}.${key}` : key, keys);
    });
  }
  return keys;
};

before(async () => {
  const connected = await connectDatabase();
  assert.equal(connected, true, 'tests need a working MongoDB connection');
});

after(async () => {
  await connectDatabase();
  await disconnectDatabase();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([HistoricalPrice.deleteMany({}), Property.deleteMany({}), User.deleteMany({})]);
});

/* -------------------------------------------------------------------------- */
/* 1. Normal asking price                                                      */
/* -------------------------------------------------------------------------- */

test('a normal asking price produces a clear screening with no triggered rule', async () => {
  await seedBenchmark();
  const response = await postCheck({ propertyId: (await createListing())._id.toString() });
  const screening = response.body.data.screening;

  assert.equal(response.status, 200);
  assert.equal(screening.status, 'clear');
  assert.equal(screening.riskLevel, 'low');
  assert.equal(screening.partial, false);
  assert.ok(screening.flags.every((flag) => flag.triggered === false));
  assert.equal(priceFlag(screening).details.deviationPercentage, 0);
  assert.match(screening.summary, /No pricing anomaly or similar active listing was detected/);
});

test('a small deviation inside the normal band stays clear', async () => {
  await seedBenchmark();
  const property = await createListing({ askingPrice: 28280000 });

  const screening = (await postCheck({ propertyId: property._id.toString() })).body.data.screening;

  assert.equal(priceFlag(screening).details.deviationPercentage, 1);
  assert.equal(priceFlag(screening).details.band, 'normal');
  assert.equal(priceFlag(screening).triggered, false);
  assert.equal(screening.status, 'clear');
});

/* -------------------------------------------------------------------------- */
/* 2. Moderate price deviation                                                 */
/* -------------------------------------------------------------------------- */

test('a moderate price deviation is flagged for review with a medium risk level', async () => {
  await seedBenchmark();
  const property = await createListing({ askingPrice: 32000000 });

  const response = await postCheck({ propertyId: property._id.toString() });
  const screening = response.body.data.screening;
  const details = priceFlag(screening).details;

  assert.equal(priceFlag(screening).triggered, true);
  assert.equal(priceFlag(screening).severity, 'medium');
  assert.equal(screening.status, 'review');
  assert.equal(screening.riskLevel, 'medium');
  assert.equal(details.deviationPercentage, 14.29);
  assert.equal(details.direction, 'above');
  assert.equal(details.band, 'review');
  assert.equal(details.askingPrice, 32000000);
  assert.equal(details.estimatedValue, BASE_ESTIMATE);
  assert.equal(details.threshold, 12);
  assert.match(priceFlag(screening).message, /price deviation was detected/i);
  assert.match(screening.summary, /review is recommended/i);
});

/* -------------------------------------------------------------------------- */
/* 3. High price deviation                                                     */
/* -------------------------------------------------------------------------- */

test('a high price deviation is elevated with a high risk level', async () => {
  await seedBenchmark();
  const property = await createListing({ askingPrice: 42000000 });

  const screening = (await postCheck({ propertyId: property._id.toString() })).body.data.screening;
  const details = priceFlag(screening).details;

  assert.equal(priceFlag(screening).triggered, true);
  assert.equal(priceFlag(screening).severity, 'high');
  assert.equal(screening.status, 'elevated');
  assert.equal(screening.riskLevel, 'high');
  assert.equal(details.deviationPercentage, 50);
  assert.equal(details.band, 'high');
  assert.equal(details.threshold, 30);
  assert.match(screening.summary, /elevated attention is recommended/i);
});

test('the high deviation boundary is inclusive and the band below it is not', async () => {
  await seedBenchmark();
  const boundary = await createListing({ askingPrice: Math.round(BASE_ESTIMATE * 1.3) });
  const justUnder = await createListing({ title: 'Just Under The Boundary', askingPrice: Math.round(BASE_ESTIMATE * 1.3) - 1 });

  const at = priceFlag((await postCheck({ propertyId: boundary._id.toString() })).body.data.screening);
  const under = priceFlag((await postCheck({ propertyId: justUnder._id.toString() })).body.data.screening);

  assert.equal(at.details.deviationPercentage, 30);
  assert.equal(at.details.band, 'high');
  assert.equal(under.details.band, 'review');
});

/* -------------------------------------------------------------------------- */
/* 4. Asking price below the estimate                                          */
/* -------------------------------------------------------------------------- */

test('an asking price below the estimate is reported as a downward deviation', async () => {
  await seedBenchmark();
  const property = await createListing({ askingPrice: 21000000 });

  const screening = (await postCheck({ propertyId: property._id.toString() })).body.data.screening;
  const details = priceFlag(screening).details;

  assert.equal(details.deviationPercentage, -25);
  assert.equal(details.direction, 'below');
  assert.equal(priceFlag(screening).triggered, true);
  assert.equal(screening.status, 'review');
  assert.match(priceFlag(screening).message, /below the current PropIQ estimate/);
});

test('a modest under-asking-price stays inside the wider below-estimate deadband', async () => {
  await seedBenchmark();
  const property = await createListing({ askingPrice: 24500000 });

  const screening = (await postCheck({ propertyId: property._id.toString() })).body.data.screening;

  assert.equal(priceFlag(screening).details.deviationPercentage, -12.5);
  assert.equal(priceFlag(screening).details.band, 'normal');
  assert.equal(priceFlag(screening).triggered, false);
  assert.equal(screening.status, 'clear');
});

test('the asymmetric below-estimate thresholds are honoured from configuration', async () => {
  await seedBenchmark();
  const far = await createListing({ askingPrice: 15000000 });
  const moderate = await createListing({ title: 'Moderate Underprice', askingPrice: 22500000, bedrooms: 4, builtUpArea: 2600 });

  const farFlag = priceFlag((await postCheck({ propertyId: far._id.toString() })).body.data.screening);
  const moderateFlag = priceFlag((await postCheck({ propertyId: moderate._id.toString() })).body.data.screening);

  assert.equal(farFlag.details.band, 'high');
  assert.equal(moderateFlag.details.band, 'review');
  assert.deepEqual(
    PRICE_DEVIATION.belowEstimate.map((band) => band.minDeviation),
    [40, 20, 0],
  );
});

/* -------------------------------------------------------------------------- */
/* Terminology and formula                                                     */
/* -------------------------------------------------------------------------- */

test('the deviation percentage uses the documented formula', () => {
  const result = evaluatePriceDeviation({ askingPrice: 9200000, estimatedValue: 8100000 });

  assert.equal(result.details.deviationPercentage, 13.58);
  assert.equal(result.details.askingPrice, 9200000);
  assert.equal(result.details.estimatedValue, 8100000);
  assert.equal(result.severity, 'medium');
  assert.equal(result.threshold, 12);
});

test('screening never claims a listing is fraudulent', async () => {
  await seedBenchmark();
  const property = await createListing({ askingPrice: 60000000 });
  const screening = (await postCheck({ propertyId: property._id.toString() })).body.data.screening;

  const text = [screening.summary, screening.disclaimer, ...screening.flags.map((flag) => flag.message)]
    .join(' ')
    .toLowerCase();

  assert.ok(!/fraudulent|is a scam|proven fraud|guaranteed/.test(text), text);
  assert.match(screening.disclaimer, /does not establish fraud/);
  assert.equal(screening.disclaimer, FRAUD_MODEL.disclaimer);
  assert.match(text, /potentially unusual|review|anomaly|deviation/);
});

test('a stored listing without an asking price reports the price rule as not evaluated', async () => {
  // The Property schema requires an asking price, so this branch is only
  // reachable through the pure function. It still has to behave correctly.
  const result = evaluatePriceDeviation({ askingPrice: null, estimatedValue: BASE_ESTIMATE });

  assert.equal(result.evaluated, false);
  assert.equal(result.triggered, false);
  assert.equal(result.severity, 'none');
  assert.equal(result.details, null);
  assert.match(result.message, /no asking price/i);
});

/* -------------------------------------------------------------------------- */
/* 5 & 6. Duplicate detected and non-duplicate                                 */
/* -------------------------------------------------------------------------- */

test('a near-identical active listing is reported as a duplicate', async () => {
  await seedBenchmark();
  const original = await createListing({ title: 'Original Listing' });
  const twin = await createListing({ title: 'Same Home Listed Again', askingPrice: 28200000 });

  const screening = (await postCheck({ propertyId: twin._id.toString() })).body.data.screening;
  const flag = duplicateFlag(screening);

  assert.equal(flag.triggered, true);
  assert.equal(flag.details.duplicateDetected, true);
  assert.ok(flag.details.matchingPropertyIds.includes(original._id.toString()));
  assert.ok(flag.details.matchScore >= DUPLICATE_MATCHING.duplicateThreshold);
  assert.ok(flag.details.matches.length >= 1);
  assert.match(flag.message, /similar active listing/i);
  assert.ok(['review', 'elevated'].includes(screening.status));
});

test('a genuinely different listing is not reported as a duplicate', async () => {
  await seedBenchmark();
  await createListing({
    title: 'Small Studio Elsewhere',
    builtUpArea: 650,
    bedrooms: 1,
    bathrooms: 1,
    propertyAge: 12,
    askingPrice: 7500000,
  });
  // Asking price matches this larger subject's own estimate, so the only rule
  // under test is the duplicate rule.
  const subject = await createListing({
    title: 'Large Family Home',
    builtUpArea: 3200,
    bedrooms: 4,
    bathrooms: 3,
    askingPrice: 44800000,
  });

  const screening = (await postCheck({ propertyId: subject._id.toString() })).body.data.screening;
  const flag = duplicateFlag(screening);

  assert.equal(flag.triggered, false);
  assert.equal(flag.details.duplicateDetected, false);
  assert.deepEqual(flag.details.matchingPropertyIds, []);
  assert.equal(flag.details.matchScore, null);
  assert.equal(flag.details.candidatesCompared, 1);
  assert.match(flag.message, /No similar active listing was detected/);
  assert.equal(priceFlag(screening).details.deviationPercentage, 0);
  assert.equal(screening.status, 'clear');
});

test('listings in a different city or property type are never duplicates', async () => {
  await seedBenchmark();
  const mumbaiTwin = await createListing({ title: 'Same Specs, Mumbai', city: 'Mumbai' });
  const plotTwin = await createListing({ title: 'Same Specs, Plot', propertyType: 'plot' });
  const subject = await createListing();

  for (const twin of [mumbaiTwin, plotTwin]) {
    const flag = duplicateFlag((await postCheck({ propertyId: subject._id.toString() })).body.data.screening);
    assert.equal(flag.triggered, false);
    assert.ok(!flag.details.matchingPropertyIds.includes(twin._id.toString()));
  }
});

test('a duplicate match must clear the configured threshold', async () => {
  await seedBenchmark();
  const borderline = await createListing({
    title: 'Borderline Similar',
    builtUpArea: 2400,
    bedrooms: 2,
    bathrooms: 1,
    propertyAge: 11,
    askingPrice: 30000000,
  });
  const subject = await createListing();

  const result = await findSimilarListings((await Property.findById(subject._id).lean()));
  const flag = duplicateFlag((await postCheck({ propertyId: subject._id.toString() })).body.data.screening);

  assert.equal(result.matches.length, 0);
  assert.equal(flag.triggered, false);
  assert.ok(
    scoreCandidate(subject, { ...listingInput(), _id: borderline._id }).matchScore >= 0,
    'borderline candidates are still scored deterministically',
  );
});

/* -------------------------------------------------------------------------- */
/* 7. Self-exclusion                                                           */
/* -------------------------------------------------------------------------- */

test('a property is never compared against itself', async () => {
  await seedBenchmark();
  const property = await createListing();

  const screening = (await postCheck({ propertyId: property._id.toString() })).body.data.screening;

  assert.equal(duplicateFlag(screening).triggered, false, 'a lone listing cannot duplicate itself');
  assert.ok(!duplicateFlag(screening).details.matchingPropertyIds.includes(property._id.toString()));
  assert.equal(duplicateFlag(screening).details.candidatesCompared, 0);
});

test('self-exclusion holds even when the listing is an exact copy', async () => {
  await seedBenchmark();
  const original = await createListing({ title: 'Original' });
  const exactCopy = await createListing({ title: 'Exact Copy' });

  const screening = (await postCheck({ propertyId: exactCopy._id.toString() })).body.data.screening;
  const ids = duplicateFlag(screening).details.matchingPropertyIds;

  assert.deepEqual(ids, [original._id.toString()]);
  assert.ok(!ids.includes(exactCopy._id.toString()));
});

/* -------------------------------------------------------------------------- */
/* 8. Matching fields                                                          */
/* -------------------------------------------------------------------------- */

test('duplicate matching reports which fields matched', async () => {
  await seedBenchmark();
  await createListing({ title: 'Close But Not Identical', askingPrice: 28100000, propertyAge: 6 });
  const subject = await createListing({ title: 'Subject' });

  const screening = (await postCheck({ propertyId: subject._id.toString() })).body.data.screening;
  const fields = duplicateFlag(screening).details.matchingFields;

  assert.ok(fields.includes('locality'));
  assert.ok(fields.includes('city'));
  assert.ok(fields.includes('propertyType'));
  assert.ok(fields.includes('builtUpArea'));
  assert.ok(fields.includes('askingPrice'));
});

test('the duplicate match score is produced by the documented weighting', () => {
  const subject = listingInput({ builtUpArea: 2000, bedrooms: 3, bathrooms: 2, propertyAge: 5, askingPrice: 28000000 });
  const near = listingInput({ builtUpArea: 1950, bedrooms: 3, bathrooms: 2, propertyAge: 6, askingPrice: 28500000 });

  const score = scoreCandidate(subject, near);

  // locality + city + propertyType = 32, bedrooms + bathrooms = 14,
  // builtUpArea (2.5% apart) = 28, askingPrice (1.8% apart) = 14,
  // propertyAge (1 year, inside the near tolerance) = half of 12 = 6.
  assert.equal(score.eligible, true);
  assert.equal(score.comparableWeight, 100);
  assert.equal(score.matchedWeight, 94);
  assert.equal(score.matchScore, 94);
  assert.ok(score.matchingFields.includes('builtUpArea'));
  assert.ok(!score.matchingFields.includes('propertyAge'));
  assert.ok(score.mismatchedFields.includes('propertyAge'));
});

test('duplicate matching is case insensitive on text fields', () => {
  const score = scoreCandidate(listingInput(), listingInput({ locality: 'indiranagar', city: 'bengaluru' }));

  assert.equal(score.matchScore, 100);
});

test('locality casing never hides an otherwise matching listing', async () => {
  await seedBenchmark();
  const original = await createListing({ title: 'Original', locality: 'Whitefield' });
  const lowercase = await createListing({ title: 'Lowercase Copy', locality: 'whitefield' });
  const uppercase = await createListing({ title: 'Uppercase Copy', locality: 'WHITEFIELD' });
  const lookalike = await createListing({
    title: 'Longer Locality Name',
    locality: 'Whitefield Extension',
    builtUpArea: 900,
    bedrooms: 1,
    bathrooms: 1,
  });

  for (const variant of [lowercase, uppercase]) {
    const flag = duplicateFlag((await postCheck({ propertyId: variant._id.toString() })).body.data.screening);

    assert.equal(flag.triggered, true, `expected a duplicate for ${variant.locality}`);
    assert.ok(flag.details.matchingPropertyIds.includes(original._id.toString()), `expected the Whitefield original in ${variant.locality}`);
  }

  // The query stays anchored, so a longer locality name is never even fetched.
  const scan = await findSimilarListings(await Property.findById(lowercase._id).lean());

  assert.equal(scan.candidatesCompared, 2, 'only the two case variants should be candidates');
  assert.ok(!scan.matches.some((match) => match.propertyId === lookalike._id.toString()));
});

test('fields missing on one side are skipped instead of treated as mismatches', () => {
  const score = scoreCandidate(
    listingInput(),
    { locality: 'Indiranagar', city: 'Bengaluru', propertyType: 'apartment', builtUpArea: 2000, askingPrice: 28000000 },
  );

  assert.equal(score.eligible, true);
  assert.equal(score.comparableWeight, 74, 'bedrooms, bathrooms and propertyAge were not comparable');
  assert.equal(score.matchScore, 100);
  assert.deepEqual(score.missingFields.sort(), ['bathrooms', 'bedrooms', 'propertyAge']);
});

test('non-comparable listings are rejected by the locality, city and type gate', () => {
  assert.equal(scoreCandidate(listingInput(), listingInput({ city: 'Mumbai' })).eligible, false);
  assert.equal(scoreCandidate(listingInput(), listingInput({ propertyType: 'plot' })).eligible, false);
  assert.equal(scoreCandidate(listingInput(), listingInput({ locality: 'Koramangala' })).eligible, false);
});

test('inactive and sold listings are not treated as comparable duplicates', async () => {
  await seedBenchmark();
  await createListing({ title: 'Withdrawn Original', status: 'inactive' });
  const subject = await createListing();

  const flag = duplicateFlag((await postCheck({ propertyId: subject._id.toString() })).body.data.screening);

  assert.equal(flag.triggered, false);
  assert.equal(flag.details.candidatesCompared, 0);
});

/* -------------------------------------------------------------------------- */
/* 9 & 10. Missing and invalid property                                        */
/* -------------------------------------------------------------------------- */

test('an unknown property id returns 404 without a stack trace', async () => {
  const response = await postCheck({ propertyId: new mongoose.Types.ObjectId().toString() });

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, 'PROPERTY_NOT_FOUND');
  assert.equal(response.body.stack, undefined);
});

test('an invalid property id is rejected with an actionable message', async () => {
  const notAnId = await postCheck({ propertyId: 'not-an-object-id' });
  assert.equal(notAnId.status, 400);
  assert.equal(notAnId.body.code, 'INVALID_PROPERTY_ID');

  const empty = await postCheck({});
  assert.equal(empty.status, 400);
  assert.equal(empty.body.code, 'INVALID_PROPERTY_ID');

  const malformed = await request(app)
    .post('/api/fraud/check')
    .set('Content-Type', 'application/json')
    .send('{"propertyId":');
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.code, 'INVALID_JSON');
});

/* -------------------------------------------------------------------------- */
/* 11. Missing valuation benchmark                                            */
/* -------------------------------------------------------------------------- */

test('a listing without any market benchmark reports unavailable rather than a risk score', async () => {
  const property = await createListing({ locality: 'Nowhere', city: 'Atlantis', askingPrice: 9000000 });

  const response = await postCheck({ propertyId: property._id.toString() });
  const screening = response.body.data.screening;

  assert.equal(response.status, 200);
  assert.equal(screening.status, 'unavailable');
  assert.equal(screening.riskLevel, null, 'no risk score may be fabricated');
  assert.equal(screening.partial, true);
  assert.equal(screening.valuation, null);
  assert.equal(screening.valuationUnavailable.code, 'INSUFFICIENT_MARKET_DATA');
  assert.equal(screening.valuationUnavailable.searched[0].city, 'Atlantis');
  assert.equal(priceFlag(screening).evaluated, false);
  assert.equal(priceFlag(screening).triggered, false);
  assert.match(screening.summary, /no current market benchmark/i);
});

test('a duplicate finding is still reported when the benchmark is missing', async () => {
  await createListing({ title: 'Uncovered Original', locality: 'Nowhere', city: 'Atlantis' });
  const twin = await createListing({ title: 'Uncovered Twin', locality: 'Nowhere', city: 'Atlantis' });

  const screening = (await postCheck({ propertyId: twin._id.toString() })).body.data.screening;

  assert.equal(duplicateFlag(screening).triggered, true);
  assert.equal(priceFlag(screening).evaluated, false);
  assert.equal(screening.riskLevel, 'high', 'the duplicate signal is still usable');
  assert.equal(screening.partial, true);
  assert.match(screening.summary, /unavailable/i);
});

/* -------------------------------------------------------------------------- */
/* 12. Determinism                                                             */
/* -------------------------------------------------------------------------- */

test('repeated checks on the same listing and data return an identical result', async () => {
  await seedBenchmark();
  await createListing({ title: 'Original', askingPrice: 28100000 });
  const property = await createListing({ title: 'Screened Twice', askingPrice: 41000000 });
  const propertyId = property._id.toString();

  const first = (await postCheck({ propertyId })).body;
  const second = (await postCheck({ propertyId })).body;
  const third = await screenStoredProperty(propertyId);

  assert.deepEqual(first, second);
  assert.deepEqual(third, JSON.parse(JSON.stringify(third)), 'a result must be JSON-stable');
  assert.equal(third.status, first.data.screening.status);
  assert.equal(third.riskLevel, first.data.screening.riskLevel);
  assert.equal(third.flags[1].details.matchingPropertyIds[0], first.data.screening.flags[1].details.matchingPropertyIds[0]);
});

test('a benchmark change immediately changes the screening outcome', async () => {
  await seedBenchmark();
  const property = await createListing({ askingPrice: 32000000 });

  const before = (await postCheck({ propertyId: property._id.toString() })).body.data.screening;
  assert.equal(priceFlag(before).details.band, 'review');
  assert.equal(priceFlag(before).details.deviationPercentage, 14.29);

  // ₹30,000/sq.ft. moves the estimate to ₹6 crore, so the same asking price is
  // now far below the estimate.
  await HistoricalPrice.updateMany({}, { $set: { averagePricePerSqFt: 30000 } });
  const after = (await postCheck({ propertyId: property._id.toString() })).body.data.screening;

  assert.equal(priceFlag(after).details.estimatedValue, 60000000);
  assert.equal(priceFlag(after).details.deviationPercentage, -46.67);
  assert.equal(priceFlag(after).details.direction, 'below');
  assert.equal(priceFlag(after).severity, 'high');
  assert.equal(after.status, 'elevated');
});

/* -------------------------------------------------------------------------- */
/* 13. Response envelope                                                       */
/* -------------------------------------------------------------------------- */

test('the endpoint uses the standard success envelope', async () => {
  await seedBenchmark();
  const property = await createListing({ askingPrice: 41000000 });

  const response = await postCheck({ propertyId: property._id.toString() });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(typeof response.body.message, 'string');
  assert.ok(response.body.data.screening);
  assert.equal(response.body.stack, undefined);
  assert.equal(response.body.error, undefined);
});

test('the response exposes the documented screening shape', async () => {
  await seedBenchmark();
  const property = await createListing({ askingPrice: 41000000 });

  const { screening } = (await postCheck({ propertyId: property._id.toString() })).body.data;

  for (const key of ['status', 'riskLevel', 'flags', 'summary', 'partial', 'valuation', 'disclaimer', 'limitations']) {
    assert.ok(key in screening, `expected ${key} in the screening payload`);
  }

  assert.equal(screening.flags.length, 2);
  assert.deepEqual(screening.flags.map((flag) => flag.type), ['PRICE_DEVIATION', 'DUPLICATE_LISTING']);
  for (const flag of screening.flags) {
    assert.equal(typeof flag.type, 'string');
    assert.equal(typeof flag.evaluated, 'boolean');
    assert.equal(typeof flag.triggered, 'boolean');
    assert.ok(RISK_LEVELS.severityOrder.includes(flag.severity));
    assert.equal(typeof flag.message, 'string');
  }

  assert.equal(screening.model.deterministic, true);
  assert.equal(screening.model.version, FRAUD_MODEL.version);
  assert.ok(Array.isArray(screening.limitations) && screening.limitations.length > 0);
});

test('the price flag exposes asking price, estimate, deviation, threshold and severity', async () => {
  await seedBenchmark();
  const property = await createListing({ askingPrice: 42000000 });

  const flag = priceFlag((await postCheck({ propertyId: property._id.toString() })).body.data.screening);

  assert.equal(flag.severity, 'high');
  assert.equal(flag.triggered, true);
  for (const key of ['askingPrice', 'estimatedValue', 'deviationPercentage', 'threshold']) {
    assert.ok(key in flag.details, `expected ${key} in the price flag details`);
  }
});

test('the duplicate flag exposes detection, ids, fields, score and explanation', async () => {
  await seedBenchmark();
  await createListing({ title: 'Original' });
  const twin = await createListing({ title: 'Twin' });

  const flag = duplicateFlag((await postCheck({ propertyId: twin._id.toString() })).body.data.screening);

  assert.equal(flag.details.duplicateDetected, true);
  assert.equal(Array.isArray(flag.details.matchingPropertyIds), true);
  assert.equal(Array.isArray(flag.details.matchingFields), true);
  assert.equal(typeof flag.details.matchScore, 'number');
  assert.equal(typeof flag.message, 'string');
});

/* -------------------------------------------------------------------------- */
/* 14. Authorization and privacy                                               */
/* -------------------------------------------------------------------------- */

test('screening is available without authentication, like the other public intelligence reads', async () => {
  await seedBenchmark();
  const property = await createListing();

  const response = await postCheck({ propertyId: property._id.toString() });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.screening.status, 'clear');
});

test('every role that can view a listing can screen it', async () => {
  await seedBenchmark();
  const property = await createListing();
  const seller = await User.create({ name: 'Seller', email: 'seller@example.com', password: 'Str0ng-PropIQ-Password', role: 'seller' });
  const buyer = await User.create({ name: 'Buyer', email: 'buyer@example.com', password: 'Str0ng-PropIQ-Password', role: 'buyer' });
  const { signToken } = await import('../utils/jwt.js');

  for (const user of [seller, buyer]) {
    const response = await request(app)
      .post('/api/fraud/check')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ propertyId: property._id.toString() });
    assert.equal(response.status, 200);
  }
});

test('the screening response never exposes seller or account information', async () => {
  await seedBenchmark();
  await createListing({ title: 'Original' });
  const property = await createListing({ title: 'Screened Listing' });

  const response = await postCheck({ propertyId: property._id.toString() });
  // `model` is PropIQ's own rule metadata, so it is asserted separately.
  const payload = structuredClone(response.body);
  assert.deepEqual(Object.keys(payload.data.screening.model).sort(), [
    'basis',
    'deterministic',
    'name',
    'version',
  ]);
  delete payload.data.screening.model;

  const keys = collectKeys(payload).map((key) => key.toLowerCase());
  const forbidden = ['owner', 'email', 'password', 'seller', 'user', 'name', 'token'];

  for (const key of forbidden) {
    assert.ok(!keys.some((path) => path.endsWith(`.${key}`) || path === key), `leaked key: ${key}`);
  }
});

/* -------------------------------------------------------------------------- */
/* 15. Valuation integration and non-regression                                */
/* -------------------------------------------------------------------------- */

test('fraud screening reuses the valuation service without duplicating the calculation', async () => {
  await seedBenchmark();
  const property = await createListing({ askingPrice: 28500000 });

  const screening = (await postCheck({ propertyId: property._id.toString() })).body.data.screening;
  const valuation = await valueStoredProperty(property._id.toString());

  assert.deepEqual(screening.valuation.estimatedValue, valuation.estimatedValue);
  assert.deepEqual(screening.valuation.baseValue, valuation.baseValue);
  assert.deepEqual(screening.valuation.amenityAdjustment, valuation.amenityAdjustment);
  assert.deepEqual(screening.valuation.ageAdjustment, valuation.ageAdjustment);
  assert.deepEqual(screening.valuation.confidence, valuation.confidence);
  assert.deepEqual(screening.valuation.marketData, valuation.marketData);
  assert.equal(screening.valuation.explanation, valuation.explanation);
});

test('analyzeProperty works from a plain property and valuation object, without HTTP', async () => {
  const assessment = await analyzeProperty(
    { _id: new mongoose.Types.ObjectId(), askingPrice: 32000000 },
    { estimatedValue: BASE_ESTIMATE },
  );

  assert.equal(assessment.status, 'review');
  assert.equal(assessment.riskLevel, 'medium');
  assert.equal(priceFlag(assessment).details.deviationPercentage, 14.29);
  assert.equal(assessment.model.deterministic, true);
});

test('analyzeProperty rejects a missing property instead of inventing a result', async () => {
  await assert.rejects(() => analyzeProperty(null, { estimatedValue: 1 }), (error) => {
    assert.equal(error.status, 400);
    assert.equal(error.code, 'PROPERTY_REQUIRED');
    return true;
  });
});

test('screening never writes to the property document', async () => {
  await seedBenchmark();
  const property = await createListing({ askingPrice: 42000000 });

  await postCheck({ propertyId: property._id.toString() });
  await postCheck({ propertyId: property._id.toString() });
  const stored = await Property.findById(property._id).lean();

  assert.equal(stored.askingPrice, 42000000, 'the asking price is unchanged');
  assert.equal(stored.fraudStatus, undefined);
  assert.equal(stored.fraudRisk, undefined);
  assert.equal(stored.estimatedValue, undefined);
  assert.equal(stored.duplicateOf, undefined);
});

test('existing property and valuation routes are unaffected', async () => {
  await seedBenchmark();
  const property = await createListing({ askingPrice: 28500000 });

  const browse = await request(app).get('/api/properties');
  assert.equal(browse.status, 200);
  assert.equal(browse.body.data.properties.length, 1);

  const detail = await request(app).get(`/api/properties/${property._id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.property.askingPrice, 28500000);

  const valuation = await request(app).post('/api/valuation').send({ propertyId: property._id.toString() });
  assert.equal(valuation.status, 200);
  assert.equal(valuation.body.data.valuation.estimatedValue, BASE_ESTIMATE);

  const unauthorised = await request(app).post('/api/properties').send({ title: 'Should Not Save' });
  assert.equal(unauthorised.status, 401);
});

test('the health endpoint still reports the database state', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, 'connected');
  assert.equal(response.body.service, 'propiq-api');
});
