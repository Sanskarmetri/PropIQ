import { isDatabaseReady } from '../config/db.js';
import { FRAUD_LIMITATIONS } from '../config/fraudConfig.js';
import { PROPERTY_STATUSES, PROPERTY_TYPES, Property } from '../models/Property.js';
import { ApiError } from '../utils/ApiError.js';
import { screenStoredProperty } from './fraudService.js';

/**
 * Admin analytics.
 * ============================================================================
 * EVERY NUMBER HERE IS COMPUTED FROM MONGODB
 * ============================================================================
 * Nothing in this service invents a value. Counts, averages, medians, shares and
 * breakdowns are MongoDB aggregations over the stored `Property` collection, and
 * the screening figures reuse `fraudService.screenStoredProperty` so the
 * dashboard and the screening endpoint can never disagree.
 *
 * Where the data cannot support a figure, the field is `null` and a note
 * explains why. Nothing is extrapolated, and no month is invented: a month with
 * no new listings is absent from the trend rather than reported as a zero.
 */

export const ANALYTICS_LIMITS = {
  /** Upper bound on how many listings are screened per request. */
  screeningLimit: 50,
  flaggedListingsLimit: 10,
  trendMonthLimit: 24,
  cityLimit: 10,
  localityLimit: 8,
};

export const ANALYTICS_LIMITATIONS = [
  'Every figure describes the listings currently stored in PropIQ, not the wider market.',
  'Asking prices are seller-set figures. PropIQ has no closed-transaction data, so nothing here is a realised sale price.',
  'Listing volume is grouped by the month a listing was created. A month with no new listings is absent from the trend rather than shown as zero.',
  'Screening figures reuse the deterministic PropIQ screening rules and are only produced for listings that have a market benchmark.',
  'City and locality filters match stored names exactly, so a differently spelled place name returns no listings.',
];

const MAX_CITY_LENGTH = 80;
const MAX_LOCALITY_LENGTH = 120;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}(-\d{2})?$/;
const TREND_DATE_FORMAT = '%Y-%m';

const SCREENING_STATUSES = ['clear', 'review', 'elevated', 'unavailable'];
const SEVERITY_ORDER = { high: 3, medium: 2, low: 1, none: 0 };
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const databaseUnavailable = () =>
  new ApiError(503, 'Analytics are unavailable while MongoDB is disconnected.', 'DATABASE_UNAVAILABLE');

const invalidFilters = (details) =>
  new ApiError(400, 'Please correct the analytics filters.', 'INVALID_ANALYTICS_FILTER', details);

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactMatch = (value) => new RegExp(`^${escapeRegExp(value)}$`, 'i');

const round = (value, digits = 1) =>
  Number.isFinite(value) ? Number(Number(value).toFixed(digits)) : null;

const share = (part, whole) => (whole > 0 ? round((part / whole) * 100, 1) : null);

const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`;

/* -------------------------------------------------------------------------- */
/* Filters                                                                     */
/* -------------------------------------------------------------------------- */

const readTextFilter = (value, field, maxLength, errors) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    errors[field] = `${field} must be a single text value`;
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > maxLength) {
    errors[field] = `${field} must be ${maxLength} characters or fewer`;
    return null;
  }
  return trimmed;
};

const readEnumFilter = (value, field, allowed, errors) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    errors[field] = `${field} must be a single text value`;
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!allowed.includes(trimmed)) {
    errors[field] = `${field} must be one of: ${allowed.join(', ')}`;
    return null;
  }
  return trimmed;
};

/**
 * Date-only values are treated as UTC days, so `to=2025-06-30` includes every
 * listing created on 30 June rather than only the first midnight of that day.
 */
const readDateFilter = (value, field, errors, { endOfDay = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    errors[field] = `${field} must be a single date value`;
    return null;
  }

  const raw = value.trim();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    errors[field] = `${field} must be a valid date such as 2025-06-30`;
    return null;
  }

  if (!endOfDay || !DATE_ONLY_PATTERN.test(raw)) {
    return parsed;
  }
  return new Date(parsed.getTime() + DAY_IN_MS - 1);
};

/**
 * Validates the analytics filters coming from a query string.
 *
 * Every value is either length bounded text, checked against a model enum, or
 * parsed as a date, so request input can never reach MongoDB as an operator.
 */
export const parseAnalyticsFilters = (query = {}) => {
  const source = query && typeof query === 'object' && !Array.isArray(query) ? query : {};
  const errors = {};

  const city = readTextFilter(source.city, 'city', MAX_CITY_LENGTH, errors);
  const locality = readTextFilter(source.locality, 'locality', MAX_LOCALITY_LENGTH, errors);
  const propertyType = readEnumFilter(source.propertyType, 'propertyType', PROPERTY_TYPES, errors);
  const status = readEnumFilter(source.status, 'status', PROPERTY_STATUSES, errors);
  const from = readDateFilter(source.from, 'from', errors);
  const to = readDateFilter(source.to, 'to', errors, { endOfDay: true });

  if (from && to && from.getTime() > to.getTime()) {
    errors.to = 'to must be the same day or later than from';
  }

  if (Object.keys(errors).length > 0) {
    throw invalidFilters(errors);
  }

  return {
    city,
    locality,
    propertyType,
    status,
    dateRange: { from, to },
    applied: {
      city,
      locality,
      propertyType,
      status,
      from: from ? from.toISOString() : null,
      to: to ? to.toISOString() : null,
      timeZone: 'UTC',
    },
    hasFilters: Boolean(city || locality || propertyType || status || from || to),
  };
};

export const buildAnalyticsFilter = ({ city, locality, propertyType, status, dateRange } = {}) => {
  const filter = {};

  if (city) {
    filter.city = exactMatch(city);
  }
  if (locality) {
    filter.locality = exactMatch(locality);
  }
  if (propertyType) {
    filter.propertyType = propertyType;
  }
  if (status) {
    filter.status = status;
  }
  if (dateRange?.from || dateRange?.to) {
    filter.createdAt = {};
    if (dateRange.from) {
      filter.createdAt.$gte = dateRange.from;
    }
    if (dateRange.to) {
      filter.createdAt.$lte = dateRange.to;
    }
  }

  return filter;
};

/* -------------------------------------------------------------------------- */
/* Aggregations                                                                */
/* -------------------------------------------------------------------------- */

// Price per square foot is derived, never stored, and a listing without a usable
// area contributes nothing instead of skewing the average with a division error.
const pricePerSqFtStage = {
  $addFields: {
    pricePerSqFt: {
      $cond: [{ $gt: ['$builtUpArea', 0] }, { $divide: ['$askingPrice', '$builtUpArea'] }, null],
    },
  },
};

const summarisePrices = async (filter) => {
  const [summary] = await Property.aggregate([
    { $match: filter },
    pricePerSqFtStage,
    {
      $group: {
        _id: null,
        totalListings: { $sum: 1 },
        activeListings: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        soldListings: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] } },
        inactiveListings: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
        totalAskingValue: { $sum: '$askingPrice' },
        activeAskingValue: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, '$askingPrice', 0] } },
        averageAskingPrice: { $avg: '$askingPrice' },
        minimumAskingPrice: { $min: '$askingPrice' },
        maximumAskingPrice: { $max: '$askingPrice' },
        averagePricePerSqFt: { $avg: '$pricePerSqFt' },
        averageBuiltUpArea: { $avg: '$builtUpArea' },
        averageBedrooms: { $avg: '$bedrooms' },
        firstListingAt: { $min: '$createdAt' },
        lastListingAt: { $max: '$createdAt' },
      },
    },
  ]);

  return summary ?? null;
};

/**
 * Median asking price without pulling every price into memory: the two middle
 * values are read straight out of the sorted result set.
 */
const medianAskingPrice = async (filter, total) => {
  if (!total) {
    return null;
  }

  const lowerIndex = Math.floor((total - 1) / 2);
  const upperIndex = Math.ceil((total - 1) / 2);
  const readAt = (index) =>
    Property.aggregate([
      { $match: filter },
      { $project: { askingPrice: 1 } },
      { $sort: { askingPrice: 1 } },
      { $skip: index },
      { $limit: 1 },
    ]).then((rows) => rows[0]?.askingPrice ?? null);

  const [lower, upper] = await Promise.all([readAt(lowerIndex), readAt(upperIndex)]);

  if (lower === null || upper === null) {
    return null;
  }
  return round((lower + upper) / 2, 0);
};

const groupByField = async (filter, groupId, { sortByListings = false, limit = null } = {}) => {
  const pipeline = [
    { $match: filter },
    pricePerSqFtStage,
    {
      $group: {
        _id: groupId,
        listings: { $sum: 1 },
        totalAskingValue: { $sum: '$askingPrice' },
        averageAskingPrice: { $avg: '$askingPrice' },
        averagePricePerSqFt: { $avg: '$pricePerSqFt' },
        minimumAskingPrice: { $min: '$askingPrice' },
        maximumAskingPrice: { $max: '$askingPrice' },
      },
    },
  ];

  pipeline.push(sortByListings ? { $sort: { listings: -1, _id: 1 } } : { $sort: { _id: 1 } });
  if (limit) {
    pipeline.push({ $limit: limit });
  }

  const rows = await Property.aggregate(pipeline);

  // The raw rows are returned with `_id` intact: each breakdown decides what its
  // own grouping key is called.
  return rows.map((row) => ({
    listings: row.listings,
    totalAskingValue: row.totalAskingValue,
    averageAskingPrice: round(row.averageAskingPrice, 0),
    averagePricePerSqFt: round(row.averagePricePerSqFt, 0),
    minimumAskingPrice: row.minimumAskingPrice,
    maximumAskingPrice: row.maximumAskingPrice,
    key: row._id,
  }));
};

const statusBreakdown = async (filter, total) => {
  const rows = await groupByField(filter, '$status');
  const byStatus = Object.fromEntries(PROPERTY_STATUSES.map((status) => [status, 0]));

  const breakdown = rows.map(({ key, ...row }) => {
    byStatus[key] = row.listings;
    return { status: key, ...row, sharePercentage: share(row.listings, total) };
  });

  return { total, byStatus, breakdown };
};

const propertyTypeBreakdown = async (filter, total) => {
  const rows = await groupByField(filter, '$propertyType', { sortByListings: true });
  return rows.map(({ key, ...row }) => ({
    propertyType: key,
    ...row,
    sharePercentage: share(row.listings, total),
  }));
};

const cityBreakdown = async (filter, total) => {
  const rows = await groupByField(filter, '$city', { sortByListings: true, limit: ANALYTICS_LIMITS.cityLimit });
  return rows.map(({ key, ...row }) => ({ city: key, ...row, sharePercentage: share(row.listings, total) }));
};

const localityBreakdown = async (filter, total) => {
  const rows = await groupByField(filter, { locality: '$locality', city: '$city' }, {
    sortByListings: true,
    limit: ANALYTICS_LIMITS.localityLimit,
  });

  return rows.map(({ key, ...row }) => ({
    locality: key.locality,
    city: key.city,
    ...row,
    sharePercentage: share(row.listings, total),
  }));
};

/**
 * Listing volume grouped by the month a listing was created. Only months that
 * contain at least one matching listing appear, so the series is a record of
 * what is in the database rather than a filled-in range.
 */
const listingTrend = async (filter) => {
  const rows = await Property.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { $dateToString: { format: TREND_DATE_FORMAT, date: '$createdAt' } },
        listings: { $sum: 1 },
        totalAskingValue: { $sum: '$askingPrice' },
        averageAskingPrice: { $avg: '$askingPrice' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const months = rows.map((row) => ({
    month: row._id,
    listings: row.listings,
    totalAskingValue: row.totalAskingValue,
    averageAskingPrice: round(row.averageAskingPrice, 0),
  }));

  const availableMonths = months.length;
  const capped = availableMonths > ANALYTICS_LIMITS.trendMonthLimit;
  const series = capped ? months.slice(-ANALYTICS_LIMITS.trendMonthLimit) : months;

  return {
    basis: 'Listings grouped by the month they were created in PropIQ',
    availableMonths,
    returnedMonths: series.length,
    capped,
    limit: ANALYTICS_LIMITS.trendMonthLimit,
    note: capped
      ? `Only the ${ANALYTICS_LIMITS.trendMonthLimit} most recent months are returned.`
      : 'Only months that contain at least one matching listing are shown, so gaps are real gaps in the data.',
    months: series,
  };
};

/* -------------------------------------------------------------------------- */
/* Screening                                                                   */
/* -------------------------------------------------------------------------- */

// Only the fields a listing card already shows, so an analytics payload can be
// rendered without widening what the public listing response exposes.
const listingCard = (property) => ({
  id: property._id.toString(),
  title: property.title,
  locality: property.locality,
  city: property.city,
  propertyType: property.propertyType,
  status: property.status,
  askingPrice: property.askingPrice,
  builtUpArea: property.builtUpArea,
  bedrooms: property.bedrooms,
  bathrooms: property.bathrooms,
  propertyAge: property.propertyAge,
  images: property.images ?? [],
  createdAt: property.createdAt ? new Date(property.createdAt).toISOString() : null,
});

const screeningRow = (screening) => {
  const priceFlag = screening.flags.find((flag) => flag.type === 'PRICE_DEVIATION');
  const duplicateFlag = screening.flags.find((flag) => flag.type === 'DUPLICATE_LISTING');

  return {
    status: screening.status,
    riskLevel: screening.riskLevel,
    partial: screening.partial,
    summary: screening.summary,
    triggeredRules: screening.flags.filter((flag) => flag.triggered).map((flag) => flag.type),
    deviationPercentage: priceFlag?.details?.deviationPercentage ?? null,
    duplicateMatchScore: duplicateFlag?.details?.matchScore ?? null,
    benchmarkUnavailable: Boolean(screening.valuationUnavailable),
  };
};

const emptyScreeningCounts = () => ({
  byStatus: Object.fromEntries(SCREENING_STATUSES.map((status) => [status, 0])),
  byRiskLevel: { low: 0, medium: 0, high: 0, unknown: 0 },
  ruleTriggers: { PRICE_DEVIATION: 0, DUPLICATE_LISTING: 0 },
  withoutBenchmark: 0,
  errors: 0,
});

/**
 * Runs the existing deterministic screening service over the listings in scope
 * and reduces each result to a small aggregate row. Nothing is written: the same
 * request against the same data always produces the same counts.
 */
const screeningSummary = async (filter, matchedListings) => {
  const counts = emptyScreeningCounts();
  const rows = [];

  if (matchedListings === 0) {
    return {
      screenedListings: 0,
      coverage: { matchedListings, screenedListings: 0, limit: ANALYTICS_LIMITS.screeningLimit, capped: false },
      ...counts,
      flaggedListings: [],
      note: 'No listings match these filters, so there is nothing to screen.',
    };
  }

  const candidates = await Property.find(filter)
    .sort({ createdAt: -1 })
    .limit(ANALYTICS_LIMITS.screeningLimit)
    .lean();

  for (const property of candidates) {
    try {
      // Sequential on purpose: every call values the listing and scans the
      // comparable listings, so running them together would only add load.
      const screening = await screenStoredProperty(property._id.toString());
      const outcome = screeningRow(screening);

      counts.byStatus[screening.status] = (counts.byStatus[screening.status] ?? 0) + 1;
      counts.byRiskLevel[screening.riskLevel ?? 'unknown'] =
        (counts.byRiskLevel[screening.riskLevel ?? 'unknown'] ?? 0) + 1;
      for (const rule of outcome.triggeredRules) {
        if (rule in counts.ruleTriggers) {
          counts.ruleTriggers[rule] += 1;
        }
      }
      if (outcome.benchmarkUnavailable) {
        counts.withoutBenchmark += 1;
      }

      rows.push({ ...listingCard(property), screening: outcome });
    } catch {
      counts.errors += 1;
    }
  }

  const flaggedListings = rows
    .filter((row) => row.screening.status === 'review' || row.screening.status === 'elevated')
    .sort((left, right) => {
      const severity = (SEVERITY_ORDER[right.screening.riskLevel] ?? 0) - (SEVERITY_ORDER[left.screening.riskLevel] ?? 0);
      if (severity !== 0) {
        return severity;
      }
      return Math.abs(right.screening.deviationPercentage ?? 0) - Math.abs(left.screening.deviationPercentage ?? 0);
    })
    .slice(0, ANALYTICS_LIMITS.flaggedListingsLimit);

  const capped = matchedListings > candidates.length;

  return {
    screenedListings: candidates.length - counts.errors,
    coverage: {
      matchedListings,
      screenedListings: candidates.length - counts.errors,
      limit: ANALYTICS_LIMITS.screeningLimit,
      capped,
    },
    ...counts,
    flaggedListings,
    note: capped
      ? `Screening is bounded to the ${ANALYTICS_LIMITS.screeningLimit} most recent matching listings, so these counts describe that set and not every matching listing.`
      : 'Every matching listing was screened with the PropIQ screening rules.',
  };
};

/* -------------------------------------------------------------------------- */
/* Public service entry points                                                 */
/* -------------------------------------------------------------------------- */

const assertDatabaseReady = () => {
  if (!isDatabaseReady()) {
    throw databaseUnavailable();
  }
};

/**
 * The admin analytics payload: KPIs, breakdowns, listing trend and screening
 * coverage, all computed for the same filter set in one place so the dashboard
 * and the report can never describe different data.
 */
export const getAnalyticsOverview = async (filters = {}) => {
  assertDatabaseReady();

  const filter = buildAnalyticsFilter(filters);
  const [prices, totalListingsInDatabase] = await Promise.all([
    summarisePrices(filter),
    Property.countDocuments({}),
  ]);

  const matchedListings = prices?.totalListings ?? 0;
  const median = await medianAskingPrice(filter, matchedListings);

  const [status, propertyTypes, cities, localities, trend, screening] = await Promise.all([
    statusBreakdown(filter, matchedListings),
    propertyTypeBreakdown(filter, matchedListings),
    cityBreakdown(filter, matchedListings),
    localityBreakdown(filter, matchedListings),
    listingTrend(filter),
    screeningSummary(filter, matchedListings),
  ]);

  const isEmpty = matchedListings === 0;
  const applied = filters.applied ?? parseAnalyticsFilters({}).applied;

  return {
    generatedAt: new Date().toISOString(),
    filters: { ...applied, hasAnyFilter: filters.hasFilters === true },
    kpis: {
      totalListings: matchedListings,
      activeListings: prices?.activeListings ?? 0,
      soldListings: prices?.soldListings ?? 0,
      inactiveListings: prices?.inactiveListings ?? 0,
      activeSharePercentage: share(prices?.activeListings ?? 0, matchedListings),
      averageAskingPrice: isEmpty ? null : round(prices.averageAskingPrice, 0),
      medianAskingPrice: median,
      minimumAskingPrice: isEmpty ? null : prices.minimumAskingPrice,
      maximumAskingPrice: isEmpty ? null : prices.maximumAskingPrice,
      averagePricePerSqFt: isEmpty ? null : round(prices.averagePricePerSqFt, 0),
      averageBuiltUpArea: isEmpty ? null : round(prices.averageBuiltUpArea, 0),
      averageBedrooms: isEmpty ? null : round(prices.averageBedrooms, 1),
      totalAskingValue: prices?.totalAskingValue ?? 0,
      activeAskingValue: prices?.activeAskingValue ?? 0,
      empty: isEmpty,
    },
    breakdowns: { status, propertyTypes, cities, localities },
    trend,
    screening,
    dataCoverage: {
      totalListingsInDatabase,
      matchedListings,
      firstListingAt: prices?.firstListingAt ? new Date(prices.firstListingAt).toISOString() : null,
      lastListingAt: prices?.lastListingAt ? new Date(prices.lastListingAt).toISOString() : null,
    },
    limitations: ANALYTICS_LIMITATIONS,
  };
};

/**
 * The same figures, shaped as a report. Every sentence in `findings` is derived
 * from the aggregations above, so a report can never state something the data
 * does not support.
 */
export const getAnalyticsReport = async (filters = {}) => {
  const overview = await getAnalyticsOverview(filters);
  const { kpis, breakdowns, screening, trend } = overview;

  const findings = [];

  if (kpis.empty) {
    findings.push('No listings match the current filters, so this report has nothing to summarise.');
  } else {
    const scopeLabel = overview.filters.hasAnyFilter
      ? 'the filtered set of listings'
      : 'every listing stored in PropIQ';

    findings.push(
      `${plural(kpis.totalListings, 'listing', 'listings')} sit in ${scopeLabel}, of which ${kpis.activeListings} are active and ${kpis.soldListings} are sold.`,
    );
    findings.push(
      `The average asking price is ${kpis.averageAskingPrice.toLocaleString('en-IN')} (median ${kpis.medianAskingPrice.toLocaleString('en-IN')}), with an average of ${kpis.averagePricePerSqFt.toLocaleString('en-IN')} per sq ft.`,
    );

    const leadingCity = breakdowns.cities[0];
    if (leadingCity) {
      findings.push(
        `${leadingCity.city} holds ${leadingCity.listings} listings (${leadingCity.sharePercentage}% of the set)${
          breakdowns.cities.length > 1 ? `, ahead of ${breakdowns.cities[1].city}` : ''
        }.`,
      );
    }

    const leadingLocality = breakdowns.localities[0];
    if (leadingLocality) {
      findings.push(
        `${leadingLocality.locality}, ${leadingLocality.city} is the most listed locality with ${leadingLocality.listings} listings.`,
      );
    }

    if (trend.months.length > 0) {
      const latest = trend.months.at(-1);
      findings.push(
        `${latest.month} is the most recent month with new listings (${plural(latest.listings, 'listing', 'listings')} created).`,
      );
    }

    findings.push(
      `Screening reviewed ${plural(screening.coverage.screenedListings, 'listing', 'listings')}: ${screening.byStatus.review} need a review and ${screening.byStatus.elevated} are elevated.`,
    );

    if (screening.byStatus.unavailable > 0) {
      findings.push(
        `${plural(screening.byStatus.unavailable, 'listing', 'listings')} could not be screened because PropIQ has no market benchmark for their location.`,
      );
    }
  }

  return {
    title: 'PropIQ listing analytics report',
    generatedAt: overview.generatedAt,
    filters: overview.filters,
    scope: {
      totalListingsInDatabase: overview.dataCoverage.totalListingsInDatabase,
      matchedListings: overview.dataCoverage.matchedListings,
      firstListingAt: overview.dataCoverage.firstListingAt,
      lastListingAt: overview.dataCoverage.lastListingAt,
    },
    summary: kpis,
    findings,
    sections: [
      {
        id: 'status',
        title: 'Listing status',
        description: 'How the matching listings are distributed across active, sold and inactive.',
        rows: breakdowns.status.breakdown,
      },
      {
        id: 'propertyType',
        title: 'Property type',
        description: 'Volume and asking price by property type.',
        rows: breakdowns.propertyTypes,
      },
      {
        id: 'city',
        title: 'City',
        description: 'Volume and asking price by city.',
        rows: breakdowns.cities,
      },
      {
        id: 'locality',
        title: 'Locality',
        description: 'The most listed localities in the current scope.',
        rows: breakdowns.localities,
      },
      {
        id: 'trend',
        title: 'Listing volume by month',
        description: trend.basis,
        rows: trend.months,
      },
      {
        id: 'screening',
        title: 'Screening',
        description: screening.note,
        rows: screening.flaggedListings,
      },
    ],
    screening,
    limitations: [...ANALYTICS_LIMITATIONS, ...FRAUD_LIMITATIONS],
  };
};

/**
 * The filter values that actually exist in the database, so the dashboard never
 * offers a city or locality that cannot be selected.
 */
export const getAnalyticsFilterOptions = async () => {
  assertDatabaseReady();

  const [cities, localities, range] = await Promise.all([
    Property.aggregate([
      { $group: { _id: '$city', listings: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Property.aggregate([
      { $group: { _id: { locality: '$locality', city: '$city' }, listings: { $sum: 1 } } },
      { $sort: { listings: -1, '_id.locality': 1 } },
    ]),
    Property.aggregate([{ $group: { _id: null, firstListingAt: { $min: '$createdAt' }, lastListingAt: { $max: '$createdAt' } } }]),
  ]);

  const bounds = range[0];

  return {
    cities: cities.map((row) => ({ name: row._id, listings: row.listings })),
    localities: localities.map((row) => ({
      name: row._id.locality,
      city: row._id.city,
      listings: row.listings,
    })),
    propertyTypes: PROPERTY_TYPES,
    statuses: PROPERTY_STATUSES,
    dateRange: {
      firstListingAt: bounds?.firstListingAt ? new Date(bounds.firstListingAt).toISOString() : null,
      lastListingAt: bounds?.lastListingAt ? new Date(bounds.lastListingAt).toISOString() : null,
    },
    limits: ANALYTICS_LIMITS,
  };
};
