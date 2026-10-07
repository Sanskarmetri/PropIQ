/**
 * PropIQ valuation configuration.
 *
 * ============================================================================
 * DEVELOPMENT MODEL ASSUMPTIONS — NOT STATISTICALLY VALIDATED MARKET WEIGHTS
 * ============================================================================
 * Every number in this file is a hand-picked development assumption chosen so
 * the rule-based engine behaves sensibly and stays explainable. None of these
 * values were fitted, backtested, or validated against real transactions. They
 * are placeholders that a future phase should replace with weights derived from
 * actual comparable sales.
 *
 * The engine is a transparent, rule-based prototype:
 *
 *   baseValue   = benchmark ₹/sq.ft. × built-up area
 *   estimated   = baseValue × (1 + amenityAdjustment) × (1 + ageAdjustment)
 *
 * with both adjustments clamped by the caps below.
 */

export const VALUATION_MODEL = {
  name: 'PropIQ rule-based valuation model',
  version: 'phase-3-prototype',
  basis: 'Locality ₹/sq.ft. benchmarks with weighted amenity and property-age adjustments',
  dataDisclaimer:
    'Benchmarks come from a small development sample dataset. They are illustrative, not live market data, and not a valuation opinion.',
};

/**
 * How the benchmark is located, best match first.
 * `score` feeds the data-quality confidence indicator (see CONFIDENCE below).
 */
export const BENCHMARK_FALLBACKS = [
  { level: 'locality-type', label: 'locality and property type match', locality: true, type: true, score: 40 },
  { level: 'locality', label: 'locality match across all property types', locality: true, type: false, score: 32 },
  { level: 'city-type', label: 'city and property type match', locality: false, type: true, score: 24 },
  { level: 'city', label: 'city match across all property types', locality: false, type: false, score: 16 },
];

export const BENCHMARK_LEVEL_LABELS = {
  'locality-type': 'exact locality and property type benchmark',
  locality: 'locality-wide benchmark across all property types',
  'city-type': 'city-wide benchmark for this property type',
  city: 'city-wide benchmark across all property types',
};

/**
 * Amenity adjustments.
 *
 * Each rule is a group of equivalent amenities so the same benefit is never
 * counted twice: a property with both "Covered parking" and "Two-car garage"
 * receives the parking adjustment once, because both match the `parking` group.
 * Matching is case-insensitive and alias based, and the longest matching alias
 * wins so "covered parking" is not credited as generic "parking".
 *
 * `percentage` is the share added to the base value when the group is present.
 */
export const AMENITY_ADJUSTMENTS = [
  {
    id: 'parking',
    label: 'Covered parking',
    percentage: 0.03,
    aliases: ['covered parking', 'reserved parking', 'car parking', 'two-car garage', 'two car garage', 'garage', 'parking'],
  },
  {
    id: 'garden',
    label: 'Private garden or landscaped outdoor space',
    percentage: 0.04,
    aliases: ['private garden', 'landscaped garden', 'garden', 'private lawn', 'outdoor space'],
  },
  {
    id: 'balcony',
    label: 'Private balcony or terrace',
    percentage: 0.025,
    aliases: ['private balcony', 'sea-facing deck', 'sun deck', 'terrace', 'balcony', 'deck'],
  },
  {
    id: 'clubhouse',
    label: 'Clubhouse or community amenities',
    percentage: 0.02,
    aliases: ['clubhouse', 'community amenities', 'club house'],
  },
  {
    id: 'pool',
    label: 'Swimming pool',
    percentage: 0.03,
    aliases: ['swimming pool', 'pool'],
  },
  {
    id: 'gym',
    label: 'Gym or fitness room',
    percentage: 0.015,
    aliases: ['gym', 'fitness room', 'fitness centre', 'fitness center'],
  },
  {
    id: 'powerBackup',
    label: 'Power backup',
    percentage: 0.015,
    aliases: ['power backup', 'power back-up', 'inverter backup', 'backup power'],
  },
  {
    id: 'solar',
    label: 'Solar or rainwater infrastructure',
    percentage: 0.02,
    aliases: ['solar panels', 'solar', 'rainwater harvesting', 'rainwater harvesting system', 'sewage treatment'],
  },
  {
    id: 'smartHome',
    label: 'Smart or home automation features',
    percentage: 0.02,
    aliases: ['smart home', 'home automation', 'automation'],
  },
  {
    id: 'security',
    label: 'Security or concierge service',
    percentage: 0.02,
    aliases: ['concierge', 'security', 'gated community', '24x7 security', 'intercom'],
  },
  {
    id: 'lift',
    label: 'Lift access',
    percentage: 0.01,
    aliases: ['lift', 'elevator'],
  },
  {
    id: 'view',
    label: 'Open, park, lake, or sea view',
    percentage: 0.035,
    aliases: ['lake view', 'sea view', 'park view', 'garden view', 'city view', 'open view', 'view'],
  },
  {
    id: 'workspace',
    label: 'Dedicated work-from-home space',
    percentage: 0.015,
    aliases: ['work-from-home nook', 'work from home nook', 'home office', 'work from home setup', 'work space', 'workspace'],
  },
  {
    id: 'servantQuarters',
    label: 'Servant or staff quarters',
    percentage: 0.015,
    aliases: ['servant quarters', 'staff quarters', 'helper room'],
  },
  {
    id: 'petFriendly',
    label: 'Pet-friendly community',
    percentage: 0.005,
    aliases: ['pet friendly', 'pet-friendly'],
  },
  {
    id: 'cycling',
    label: 'Cycling or open activity space',
    percentage: 0.01,
    aliases: ['cycling room', 'cycling track', 'play area', 'kids play area', 'open activity space'],
  },
  {
    id: 'eastFacing',
    label: 'East facing plot',
    percentage: 0.02,
    aliases: ['east facing', 'east-facing'],
  },
  {
    id: 'clearTitle',
    label: 'Clear title',
    percentage: 0.01,
    aliases: ['clear title', 'clean title'],
  },
];

/**
 * Property-age depreciation bands (development assumptions).
 * A newer property depreciates less; an older one depreciates more.
 * `maxAge` is inclusive and the first matching band wins.
 */
export const AGE_BANDS = [
  { label: 'new or under 2 years old', maxAge: 1, percentage: 0 },
  { label: '2 to 5 years old', maxAge: 5, percentage: -0.01 },
  { label: '6 to 10 years old', maxAge: 10, percentage: -0.03 },
  { label: '11 to 15 years old', maxAge: 15, percentage: -0.06 },
  { label: '16 to 25 years old', maxAge: 25, percentage: -0.1 },
  { label: 'over 25 years old', maxAge: 200, percentage: -0.15 },
];

/**
 * Guard rails so the model cannot produce an unreasonable output.
 */
export const VALUATION_LIMITS = {
  maxArea: 1000000,
  maxAskingPrice: 10000000000,
  maxAmenityAdjustment: 0.25,
  minAgeAdjustment: -0.2,
  minEstimatedValue: 100000,
  maxEstimatedValueMultiple: 2.5,
  rounding: {
    currency: 1,
    pricePerSqFt: 0,
  },
};

/**
 * Data-quality confidence indicator.
 *
 * This is NOT a statistical confidence interval and NOT a probability of being
 * correct. It only describes how well the market data supports the estimate:
 * how precisely the benchmark matched the property, whether it was type
 * specific, and how many sample records sat behind it.
 */
export const CONFIDENCE = {
  label: 'Data-quality confidence',
  description:
    'Describes how closely the market benchmark matched this property and how many sample records backed it. It is not a statistical confidence interval or a probability of accuracy.',
  typeMatchBonus: 10,
  sampleSizeTiers: [
    { min: 50, score: 30 },
    { min: 20, score: 24 },
    { min: 10, score: 18 },
    { min: 5, score: 12 },
    { min: 3, score: 6 },
  ],
  minSampleSizeScore: 3,
  bands: [
    { min: 75, level: 'high' },
    { min: 50, level: 'medium' },
  ],
  lowLevel: 'low',
  max: 100,
};

export const CONFIDENCE_LEVEL_DESCRIPTIONS = {
  high: 'Benchmark matched the locality and property type, backed by a healthy sample size.',
  medium: 'Benchmark matched reasonably well, but with a limited sample or a broader fallback.',
  low: 'Benchmark came from a broad city-level fallback with little supporting data.',
};
