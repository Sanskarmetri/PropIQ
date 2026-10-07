import mongoose from 'mongoose';
import { isDatabaseReady } from '../config/db.js';
import { HistoricalPrice } from '../models/HistoricalPrice.js';
import { Property } from '../models/Property.js';
import {
  AGE_BANDS,
  AMENITY_ADJUSTMENTS,
  BENCHMARK_FALLBACKS,
  BENCHMARK_LEVEL_LABELS,
  CONFIDENCE,
  CONFIDENCE_LEVEL_DESCRIPTIONS,
  VALUATION_LIMITS,
  VALUATION_MODEL,
} from '../config/valuationConfig.js';
import { ApiError } from '../utils/ApiError.js';
import { formatCurrency, formatNumber } from '../utils/formatCurrency.js';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const exactText = (value) => new RegExp(`^${escapeRegExp(value)}$`, 'i');

const round = (value, decimals = 0) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const asPercentage = (value) => `${round(value * 100, 1)}%`;

const signedPercentage = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${asPercentage(Math.abs(value))}`;

/* -------------------------------------------------------------------------- */
/* Benchmark lookup                                                            */
/* -------------------------------------------------------------------------- */

const serializeBenchmark = (record, level) => ({
  id: record._id.toString(),
  locality: record.locality,
  city: record.city,
  propertyType: record.propertyType,
  averagePricePerSqFt: record.averagePricePerSqFt,
  sampleSize: record.sampleSize,
  source: record.source,
  period: record.period,
  matchedLevel: level,
  matchedLevelLabel: BENCHMARK_LEVEL_LABELS[level],
});

/**
 * Walks the documented fallback hierarchy and returns the first benchmark found.
 *
 *   1. locality + city + propertyType
 *   2. locality + city            (all property types combined)
 *   3. city + propertyType
 *   4. city                       (all property types combined)
 *   5. nothing usable
 */
export const findBenchmark = async ({ locality, city, propertyType }) => {
  const attempts = [];

  for (const fallback of BENCHMARK_FALLBACKS) {
    const filter = fallback.locality
      ? { locality: exactText(locality), city: exactText(city) }
      : { city: exactText(city) };
    filter.propertyType = fallback.type ? propertyType : null;

    const record = await HistoricalPrice.findOne(filter);
    attempts.push({ level: fallback.level, matched: Boolean(record) });

    if (record) {
      return { benchmark: serializeBenchmark(record, fallback.level), attempts, score: fallback.score };
    }
  }

  return { benchmark: null, attempts, score: 0 };
};

/* -------------------------------------------------------------------------- */
/* Amenity adjustment                                                          */
/* -------------------------------------------------------------------------- */

const normalizeAmenity = (value) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Maps one amenity to a configured group, or null when it is not recognised.
 * The longest matching alias wins, so "covered parking" resolves to the parking
 * group without also matching the shorter generic "parking" alias.
 */
const matchAmenityRule = (normalized) => {
  let best = null;

  for (const rule of AMENITY_ADJUSTMENTS) {
    for (const alias of rule.aliases) {
      if (normalized !== alias && !normalized.includes(alias)) continue;
      if (!best || alias.length > best.aliasLength) {
        best = { rule, aliasLength: alias.length };
      }
    }
  }

  return best ? best.rule : null;
};

/**
 * Groups equivalent amenities so the same benefit is only credited once.
 * Unrecognised amenities are reported but never fail the valuation.
 */
export const resolveAmenities = (amenities = []) => {
  const recognizedByGroup = new Map();
  const unrecognized = [];

  for (const amenity of amenities) {
    const rule = matchAmenityRule(normalizeAmenity(amenity));
    if (!rule) {
      unrecognized.push(amenity);
      continue;
    }
    if (!recognizedByGroup.has(rule.id)) {
      recognizedByGroup.set(rule.id, { ...rule, matched: [] });
    }
    recognizedByGroup.get(rule.id).matched.push(amenity);
  }

  const recognized = [...recognizedByGroup.values()];
  const rawTotal = recognized.reduce((total, rule) => total + rule.percentage, 0);
  const total = Math.min(rawTotal, VALUATION_LIMITS.maxAmenityAdjustment);
  const capped = rawTotal > total;

  return {
    recognized,
    unrecognized,
    rawTotal,
    total,
    capped,
    limit: VALUATION_LIMITS.maxAmenityAdjustment,
  };
};

/* -------------------------------------------------------------------------- */
/* Property-age adjustment                                                     */
/* -------------------------------------------------------------------------- */

export const resolveAgeAdjustment = (propertyAge) => {
  const age = Number.isFinite(propertyAge) && propertyAge > 0 ? Math.floor(propertyAge) : 0;
  const band = AGE_BANDS.find((candidate) => age <= candidate.maxAge) ?? AGE_BANDS[AGE_BANDS.length - 1];
  const percentage = Math.max(band.percentage, VALUATION_LIMITS.minAgeAdjustment);

  return { age, band: band.label, percentage };
};

/* -------------------------------------------------------------------------- */
/* Data-quality confidence                                                      */
/* -------------------------------------------------------------------------- */

const sampleSizeScore = (sampleSize) => {
  const tier = CONFIDENCE.sampleSizeTiers.find((candidate) => sampleSize >= candidate.min);
  return tier ? tier.score : CONFIDENCE.minSampleSizeScore;
};

const confidenceLevel = (score) =>
  CONFIDENCE.bands.find((band) => score >= band.min)?.level ?? CONFIDENCE.lowLevel;

const buildConfidence = ({ benchmark, fallbackScore }) => {
  const typeSpecific = Boolean(benchmark.propertyType);
  const score = Math.min(
    CONFIDENCE.max,
    fallbackScore + (typeSpecific ? CONFIDENCE.typeMatchBonus : 0) + sampleSizeScore(benchmark.sampleSize),
  );
  const level = confidenceLevel(score);

  return {
    label: CONFIDENCE.label,
    score,
    level,
    description: CONFIDENCE_LEVEL_DESCRIPTIONS[level],
    basis: CONFIDENCE.description,
    factors: {
      benchmarkMatch: BENCHMARK_LEVEL_LABELS[benchmark.matchedLevel],
      propertyTypeSpecific: typeSpecific,
      sampleSize: benchmark.sampleSize,
    },
  };
};

/* -------------------------------------------------------------------------- */
/* Explanation                                                                 */
/* -------------------------------------------------------------------------- */

const listToSentence = (items) => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};

const amenitySentence = (amenities) => {
  if (amenities.recognized.length === 0) {
    return 'No configured amenities were recognised, so no amenity adjustment was applied';
  }

  const contributions = amenities.recognized.map(
    (rule) => `${rule.label} (${signedPercentage(rule.percentage)})`,
  );
  const capNote = amenities.capped
    ? `, capped at ${signedPercentage(amenities.total)}`
    : '';

  return `Recognised amenities contributed ${signedPercentage(amenities.total)}${capNote} from ${listToSentence(contributions)}`;
};

const ageSentence = (age) => {
  if (age.percentage === 0) {
    return `a property aged ${age.age} ${age.age === 1 ? 'year' : 'years'} sits in the ${age.band} band, so no age adjustment was applied`;
  }
  return `a property aged ${age.age} ${age.age === 1 ? 'year' : 'years'} falls in the ${age.band} band and contributed ${signedPercentage(age.percentage)}`;
};

const buildExplanation = ({ property, benchmark, baseValue, amenities, age, estimatedValue, confidence }) => {
  const scope = benchmark.locality ? `${benchmark.locality}, ${benchmark.city}` : `${benchmark.city} (all localities)`;
  return `Based on ${formatNumber(benchmark.sampleSize)} sample comparable record${benchmark.sampleSize === 1 ? '' : 's'} from the ${BENCHMARK_LEVEL_LABELS[benchmark.matchedLevel]} for ${scope}, the benchmark is ${formatCurrency(benchmark.averagePricePerSqFt)} per sq.ft. The property's ${formatNumber(property.builtUpArea)} sq.ft. area produces a base estimate of ${formatCurrency(baseValue)}. ${amenitySentence(amenities)}, while ${ageSentence(age)}. That gives a PropIQ estimated value of ${formatCurrency(estimatedValue)} at ${formatCurrency(Math.round(estimatedValue / property.builtUpArea))} per sq.ft., with ${confidence.level} data-quality confidence.`;
};

/* -------------------------------------------------------------------------- */
/* Core calculation                                                            */
/* -------------------------------------------------------------------------- */

const insufficientMarketData = (property, attempts) =>
  new ApiError(
    422,
    'There is not enough sample market data to value this property yet.',
    'INSUFFICIENT_MARKET_DATA',
    {
      searched: [{ locality: property.locality, city: property.city, propertyType: property.propertyType }],
      fallbackAttempts: attempts,
      hint: 'Seed the development market dataset with npm run seed:market, or value a property in a covered locality.',
    },
  );

/**
 * The full calculation, including the intermediate objects needed to explain it.
 */
const computeValuation = ({ property, benchmark, fallbackScore }) => {
  const amenities = resolveAmenities(property.amenities);
  const age = resolveAgeAdjustment(property.propertyAge);
  const baseValue = round(benchmark.averagePricePerSqFt * property.builtUpArea, VALUATION_LIMITS.rounding.currency);

  const afterAmenities = baseValue * (1 + amenities.total);
  const afterAge = afterAmenities * (1 + age.percentage);
  const confidence = buildConfidence({ benchmark, fallbackScore });

  const uncapped = round(afterAge, VALUATION_LIMITS.rounding.currency);
  const ceiling = round(baseValue * VALUATION_LIMITS.maxEstimatedValueMultiple, VALUATION_LIMITS.rounding.currency);
  const estimatedValue = Math.min(Math.max(uncapped, VALUATION_LIMITS.minEstimatedValue), ceiling);

  return { baseValue, amenities, age, confidence, estimatedValue };
};

/**
 * Builds the public valuation result from the computed intermediates.
 */
const buildValuationResult = ({ property, benchmark, computed }) => ({
  estimatedValue: computed.estimatedValue,
  estimatedPricePerSqFt: round(
    computed.estimatedValue / property.builtUpArea,
    VALUATION_LIMITS.rounding.pricePerSqFt,
  ),
  benchmarkPricePerSqFt: benchmark.averagePricePerSqFt,
  baseValue: computed.baseValue,
  amenityAdjustment: {
    total: round(computed.amenities.total, 4),
    rawTotal: round(computed.amenities.rawTotal, 4),
    capped: computed.amenities.capped,
    limit: computed.amenities.limit,
    recognized: computed.amenities.recognized.map((rule) => ({
      id: rule.id,
      label: rule.label,
      percentage: rule.percentage,
      matched: rule.matched,
    })),
    unrecognized: computed.amenities.unrecognized,
  },
  ageAdjustment: {
    age: computed.age.age,
    band: computed.age.band,
    percentage: round(computed.age.percentage, 4),
  },
  confidence: computed.confidence,
  marketData: benchmark,
  model: {
    name: VALUATION_MODEL.name,
    version: VALUATION_MODEL.version,
    formula:
      'baseValue = benchmark ₹/sq.ft. × built-up area; estimated = baseValue × (1 + amenityAdjustment) × (1 + ageAdjustment)',
    limits: VALUATION_LIMITS,
  },
});

/**
 * Runs the calculation once and returns both the public result and the
 * intermediates the explanation needs, so no arithmetic is repeated.
 */
const runCalculation = ({ property, benchmark, fallbackScore = 0 }) => {
  if (!benchmark) {
    return null;
  }

  const computed = computeValuation({ property, benchmark, fallbackScore });

  return { computed, result: buildValuationResult({ property, benchmark, computed }) };
};

/**
 * Pure, synchronous valuation calculation.
 *
 *   baseValue = benchmark ₹/sq.ft. × built-up area
 *   estimated = baseValue × (1 + amenityAdjustment) × (1 + ageAdjustment)
 *
 * Exported separately from the database lookup so the arithmetic can be tested
 * without any MongoDB connection.
 */
export const calculateValuation = (args) => runCalculation(args)?.result ?? null;

/* -------------------------------------------------------------------------- */
/* Entry points                                                                */
/* -------------------------------------------------------------------------- */

const loadPropertyForValuation = async (propertyId) => {
  if (!mongoose.isValidObjectId(propertyId)) {
    throw new ApiError(400, 'The supplied property id is invalid.', 'INVALID_PROPERTY_ID');
  }

  const property = await Property.findById(propertyId).lean();
  if (!property) {
    throw new ApiError(404, 'Property not found.', 'PROPERTY_NOT_FOUND');
  }

  return property;
};

const unavailable = () =>
  new ApiError(503, 'Valuation data is unavailable while MongoDB is disconnected.', 'DATABASE_UNAVAILABLE');

/**
 * Values a property that already exists in MongoDB.
 * Nothing is written back: the estimate is always recalculated from the current
 * benchmark data and the current stored property details.
 */
export const valueStoredProperty = async (propertyId) => {
  if (!isDatabaseReady()) {
    throw unavailable();
  }

  const property = await loadPropertyForValuation(propertyId);
  return valueProperty(property, { source: 'property' });
};

/**
 * Values inline property characteristics, or a stored property when
 * `propertyId` is supplied.
 */
export const valueProperty = async (input, { source = 'inline' } = {}) => {
  if (!isDatabaseReady()) {
    throw unavailable();
  }

  const property =
    source === 'property'
      ? input
      : {
          ...input,
          propertyAge: input.propertyAge ?? 0,
          amenities: input.amenities ?? [],
          bedrooms: input.bedrooms ?? 0,
          bathrooms: input.bathrooms ?? 0,
        };

  const { benchmark, attempts, score } = await findBenchmark({
    locality: property.locality,
    city: property.city,
    propertyType: property.propertyType,
  });

  if (!benchmark) {
    throw insufficientMarketData(property, attempts);
  }

  const { computed, result } = runCalculation({ property, benchmark, fallbackScore: score });
  const valuation = result;

  return {
    source,
    property: {
      id: property._id ? property._id.toString() : null,
      title: property.title || null,
      locality: property.locality,
      city: property.city,
      propertyType: property.propertyType,
      builtUpArea: property.builtUpArea,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      propertyAge: property.propertyAge,
      amenities: property.amenities,
      ...(property.askingPrice === undefined ? {} : { askingPrice: property.askingPrice }),
    },
    ...valuation,
    explanation: buildExplanation({ property, benchmark, ...computed }),
    disclaimer: VALUATION_MODEL.dataDisclaimer,
  };
};
