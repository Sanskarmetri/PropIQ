/**
 * PropIQ listing screening configuration.
 * ============================================================================
 * DETERMINISTIC DEVELOPMENT ASSUMPTIONS — NOT A RISK MODEL
 * ============================================================================
 * Every threshold below is a hand-picked development assumption. None of these
 * values were fitted against real listing data, fraud reports, or chargeback
 * outcomes. They exist so the screening behaves consistently and can be
 * explained, and a later phase should replace them with figures derived from
 * actual data.
 *
 * The screening is intentionally NOT probabilistic. There is no machine
 * learning, no external fraud feed, and no LLM anywhere in this path. The same
 * property and the same market data always produce the same result.
 *
 * A flag means "this listing deserves a human look", never "this listing is
 * fraudulent". Legitimate sellers overprice, underprice, relist, and reuse
 * boilerplate text all the time.
 */

export const FRAUD_MODEL = {
  name: 'PropIQ rule-based listing screening',
  version: 'phase-4',
  basis: 'Deterministic price-deviation and duplicate-listing rules built on the PropIQ valuation service',
  /**
   * The single sentence that must accompany any screening output. Wording is
   * deliberately non-accusatory: screening flags review, it does not prove fraud.
   */
  disclaimer:
    'This is a deterministic rule-based screening system. A flag indicates that a listing requires review and does not establish fraud.',
  terminology: {
    use: [
      'pricing anomaly',
      'price deviation detected',
      'requires review',
      'potentially unusual pricing',
      'similar active listing',
    ],
    avoid: [
      'fraud',
      'fraudulent',
      'scam',
      'fake listing',
      'guaranteed',
      'proof',
      'conclusive',
    ],
  },
};

/* -------------------------------------------------------------------------- */
/* Rule 1 — price deviation                                                    */
/* -------------------------------------------------------------------------- */

/**
 *   deviationPercentage = ((askingPrice - estimatedValue) / estimatedValue) × 100
 *
 * A positive value means the asking price sits above the PropIQ estimate.
 *
 * The bands are intentionally asymmetric. An asking price far above the
 * estimate is a pattern worth a second look (it can be a bait price, a
 * mispriced listing, or simply a stale figure). An asking price far below the
 * estimate is treated more leniently in this first development pass, because
 * genuinely cheap listings are common in any market and over-flagging them
 * would make the whole screening noisy. Both directions remain visible in the
 * response, and the bands are configuration, not hard-coded logic.
 */
export const PRICE_DEVIATION = {
  // Absolute deviation bands, evaluated from the highest threshold downwards.
  aboveEstimate: [
    { id: 'high', minDeviation: 30, severity: 'high' },
    { id: 'review', minDeviation: 12, severity: 'medium' },
    { id: 'normal', minDeviation: 0, severity: 'none' },
  ],
  belowEstimate: [
    { id: 'high', minDeviation: 40, severity: 'high' },
    { id: 'review', minDeviation: 20, severity: 'medium' },
    { id: 'normal', minDeviation: 0, severity: 'none' },
  ],
  // Deviation at or below this value is reported with no digits of noise.
  rounding: 2,
  // A missing asking price cannot be screened, so the rule is skipped.
  requiresAskingPrice: true,
};

/* -------------------------------------------------------------------------- */
/* Rule 2 — duplicate listings                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Duplicate matching is a documented, deterministic score.
 *
 * Step 1 — gate. Locality, city, and property type must all match. Two
 * listings in different cities, or an apartment and a plot, are never treated
 * as duplicates regardless of price and size.
 *
 * Step 2 — score the comparable characteristics. Each field scores its full
 * weight when the relative difference is within `tolerance`, half weight when
 * the relative difference is within `nearTolerance`, and zero beyond that.
 *
 *   relativeDifference = |a - b| / max(a, b)
 *
 * Step 3 — normalise. The score is reported as a percentage of the weight that
 * could actually be compared, so a missing field on one side never inflates or
 * deflates the result:
 *
 *   matchScore = round(100 × matchedWeight / comparableWeight)
 *
 * Step 4 — threshold. `duplicateThreshold` is the match score at or above which
 * a listing is reported as a similar listing. The weights sum to 100.
 */
export const DUPLICATE_MATCHING = {
  duplicateThreshold: 70,
  strongMatchThreshold: 88,
  // Only these listing states are treated as comparable duplicates. A withdrawn
  // or sold listing is not something a buyer can be redirected to.
  comparableStatuses: ['active'],
  // Upper bound on candidates pulled from MongoDB for in-memory scoring.
  maxCandidates: 200,
  fields: [
    { field: 'locality', weight: 12, kind: 'text' },
    { field: 'city', weight: 10, kind: 'text' },
    { field: 'propertyType', weight: 10, kind: 'text' },
    { field: 'builtUpArea', weight: 28, kind: 'number', tolerance: 0.05, nearTolerance: 0.15 },
    { field: 'bedrooms', weight: 8, kind: 'number', tolerance: 0, nearTolerance: 0.25 },
    { field: 'bathrooms', weight: 6, kind: 'number', tolerance: 0, nearTolerance: 0.34 },
    { field: 'propertyAge', weight: 12, kind: 'number', tolerance: 0.15, nearTolerance: 0.5 },
    { field: 'askingPrice', weight: 14, kind: 'number', tolerance: 0.05, nearTolerance: 0.2 },
  ],
};

/* -------------------------------------------------------------------------- */
/* Severity and status mapping                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The overall assessment is the highest severity raised by any triggered flag.
 * `riskLevel` stays `null` when no rule could be evaluated, so an unavailable
 * screening is never presented as a low-risk result.
 */
export const RISK_LEVELS = {
  severityOrder: ['none', 'low', 'medium', 'high'],
  statusBySeverity: {
    none: { status: 'clear', riskLevel: 'low' },
    low: { status: 'clear', riskLevel: 'low' },
    medium: { status: 'review', riskLevel: 'medium' },
    high: { status: 'elevated', riskLevel: 'high' },
  },
  // A duplicate at or above the strong-match score is treated as a high signal.
  duplicateStrongMatchSeverity: 'high',
};

export const FRAUD_LIMITATIONS = [
  'Screening is rule-based and deterministic; it does not predict behaviour and cannot confirm wrongdoing.',
  'Price deviation depends on the accuracy of the PropIQ estimate, which itself uses development sample benchmarks.',
  'A low or clear result means no rule was triggered, not that a listing is safe.',
  'Duplicate matching only compares listings already stored in PropIQ, and only within the configured comparable statuses.',
  'Seller identity, ownership documents, and payment behaviour are out of scope for this phase.',
];
