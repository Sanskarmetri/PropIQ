import { isDatabaseReady } from '../config/db.js';
import {
  DUPLICATE_MATCHING,
  FRAUD_LIMITATIONS,
  FRAUD_MODEL,
  PRICE_DEVIATION,
  RISK_LEVELS,
} from '../config/fraudConfig.js';
import { Property } from '../models/Property.js';
import { ApiError } from '../utils/ApiError.js';
import { findSimilarListings } from './duplicateDetectionService.js';
import { valueStoredProperty } from './valuationService.js';

const databaseUnavailable = () =>
  new ApiError(503, 'Screening data is unavailable while MongoDB is disconnected.', 'DATABASE_UNAVAILABLE');

/**
 * Price-deviation rule.
 *
 *   deviationPercentage = ((askingPrice - estimatedValue) / estimatedValue) × 100
 *
 * The band comes from `PRICE_DEVIATION` configuration, so no threshold is
 * hard-coded here. A deviation only ever describes how the asking price compares
 * with an estimate. It is never evidence of wrongdoing.
 */
export const evaluatePriceDeviation = ({ askingPrice, estimatedValue }) => {
  if (!Number.isFinite(askingPrice) || askingPrice <= 0) {
    return {
      evaluated: false,
      triggered: false,
      severity: 'none',
      message: 'This listing has no asking price, so the price deviation check was skipped.',
      details: null,
    };
  }

  if (!Number.isFinite(estimatedValue) || estimatedValue <= 0) {
    return {
      evaluated: false,
      triggered: false,
      severity: 'none',
      message: 'A usable PropIQ estimate is required before the price deviation check can run.',
      details: null,
    };
  }

  const deviationPercentage = ((askingPrice - estimatedValue) / estimatedValue) * 100;
  const roundedDeviation = Number(deviationPercentage.toFixed(PRICE_DEVIATION.rounding));
  const direction = deviationPercentage >= 0 ? 'above' : 'below';
  const bands = deviationPercentage >= 0 ? PRICE_DEVIATION.aboveEstimate : PRICE_DEVIATION.belowEstimate;
  const band = bands.find((candidate) => Math.abs(deviationPercentage) >= candidate.minDeviation) ?? bands.at(-1);

  const magnitude = `${Math.abs(roundedDeviation).toFixed(PRICE_DEVIATION.rounding)}%`;
  const messages = {
    high: `The asking price is ${magnitude} ${direction} the current PropIQ estimate, which is potentially unusual pricing. A review is recommended.`,
    review: `The asking price is ${magnitude} ${direction} the current PropIQ estimate. A price deviation was detected and is worth a look.`,
    normal: `The asking price is within ${magnitude} of the current PropIQ estimate, which sits in a normal pricing range.`,
  };

  return {
    evaluated: true,
    triggered: band.severity !== 'none',
    severity: band.severity,
    band: band.id,
    direction,
    threshold: band.minDeviation,
    message: messages[band.id],
    details: {
      askingPrice,
      estimatedValue,
      deviationPercentage: roundedDeviation,
      direction,
      band: band.id,
      threshold: band.minDeviation,
      thresholds: {
        aboveEstimate: PRICE_DEVIATION.aboveEstimate.map(({ id, minDeviation }) => ({ id, minDeviation })),
        belowEstimate: PRICE_DEVIATION.belowEstimate.map(({ id, minDeviation }) => ({ id, minDeviation })),
      },
    },
  };
};

/**
 * Duplicate-listing rule. Delegates entirely to the duplicate detection service so
 * the matching logic keeps exactly one implementation.
 */
export const evaluateDuplicateListings = async (property, { limit = 5 } = {}) => {
  const result = await findSimilarListings(property, { limit });
  const comparableCount = result.candidatesCompared;
  const comparableLabel = `across ${comparableCount} comparable listing${comparableCount === 1 ? '' : 's'}`;

  if (result.matches.length === 0) {
    return {
      evaluated: true,
      triggered: false,
      severity: 'none',
      message: `No similar active listing was detected ${comparableLabel}.`,
      duplicateDetected: false,
      matchingPropertyIds: [],
      matchingFields: [],
      matchScore: null,
      threshold: result.threshold,
      candidatesCompared: comparableCount,
      matches: [],
    };
  }

  const strongest = result.matches[0];
  const severity =
    strongest.matchScore >= DUPLICATE_MATCHING.strongMatchThreshold
      ? RISK_LEVELS.duplicateStrongMatchSeverity
      : 'medium';
  const listingLabel = `${result.matches.length} similar active listing${result.matches.length === 1 ? '' : 's'}`;

  return {
    evaluated: true,
    triggered: true,
    severity,
    message: `${listingLabel} found with a match score of up to ${strongest.matchScore}%. Overlapping listings can mislead buyers, so this warrants review.`,
    duplicateDetected: true,
    matchingPropertyIds: result.matchingPropertyIds,
    matchingFields: result.matchingFields,
    matchScore: strongest.matchScore,
    threshold: result.threshold,
    candidatesCompared: comparableCount,
    matches: result.matches,
  };
};

/**
 * Highest severity wins. When no rule could be evaluated the risk level stays
 * `null`, so an unavailable screening is never reported as a low-risk result.
 */
const summarise = (flags) => {
  const raised = flags.filter((flag) => flag.triggered);
  const anySkipped = flags.some((flag) => !flag.evaluated);

  if (raised.length === 0) {
    return {
      status: anySkipped ? 'partial' : 'clear',
      riskLevel: 'low',
      summary: anySkipped
        ? 'No rule was triggered, but not every screening check could run for this listing.'
        : 'No pricing anomaly or similar active listing was detected by the current screening rules.',
    };
  }

  const highest = raised.reduce((current, flag) =>
    RISK_LEVELS.severityOrder.indexOf(flag.severity) > RISK_LEVELS.severityOrder.indexOf(current)
      ? flag.severity
      : current,
  'none');

  const { status, riskLevel } = RISK_LEVELS.statusBySeverity[highest] ?? RISK_LEVELS.statusBySeverity.none;
  const priceFlag = flags.find((flag) => flag.type === 'PRICE_DEVIATION');
  const duplicateFlag = flags.find((flag) => flag.type === 'DUPLICATE_LISTING');

  const findings = [];
  if (priceFlag.triggered) {
    findings.push(
      priceFlag.severity === 'high'
        ? 'the asking price is materially away from the current PropIQ estimate'
        : 'a price deviation from the current PropIQ estimate was detected',
    );
  }
  if (duplicateFlag.triggered) {
    findings.push('a similar active listing already covers the same characteristics');
  }

  const [first, second] = findings;
  const combined = findings.length > 1 ? `${first}, and ${second}` : first;

  return {
    status,
    riskLevel,
    summary: `Pricing screening flagged this listing: ${combined}. ${
      highest === 'high' ? 'Elevated attention is recommended.' : 'A manual review is recommended.'
    }`,
  };
};

/**
 * Runs every screening rule against a property and an existing valuation result.
 *
 * Deliberately free of HTTP, chat, and message concerns, so a future in-app
 * assistant (PropVal) can call it with exactly the arguments the controller uses.
 */
export const analyzeProperty = async (property, valuation) => {
  if (!property) {
    throw new ApiError(400, 'A property is required to run screening.', 'PROPERTY_REQUIRED');
  }

  const priceRule = evaluatePriceDeviation({
    askingPrice: property.askingPrice,
    estimatedValue: valuation?.estimatedValue ?? null,
  });
  const duplicateRule = await evaluateDuplicateListings(property);

  const flags = [
    {
      type: 'PRICE_DEVIATION',
      title: 'Pricing',
      evaluated: priceRule.evaluated,
      triggered: priceRule.triggered,
      severity: priceRule.severity,
      message: priceRule.message,
      details: priceRule.details,
    },
    {
      type: 'DUPLICATE_LISTING',
      title: 'Duplicate listing',
      evaluated: duplicateRule.evaluated,
      triggered: duplicateRule.triggered,
      severity: duplicateRule.severity,
      message: duplicateRule.message,
      details: {
        duplicateDetected: duplicateRule.duplicateDetected,
        matchingPropertyIds: duplicateRule.matchingPropertyIds,
        matchingFields: duplicateRule.matchingFields,
        matchScore: duplicateRule.matchScore,
        threshold: duplicateRule.threshold,
        candidatesCompared: duplicateRule.candidatesCompared,
        matches: duplicateRule.matches,
      },
    },
  ];

  const { status, riskLevel, summary } = summarise(flags);
  const completedChecks = flags.filter((flag) => flag.evaluated).length;

  return {
    status,
    riskLevel,
    flags,
    summary,
    partial: completedChecks < flags.length,
    model: {
      name: FRAUD_MODEL.name,
      version: FRAUD_MODEL.version,
      basis: FRAUD_MODEL.basis,
      deterministic: true,
    },
    checks: flags.map((flag) => ({
      type: flag.type,
      evaluated: flag.evaluated,
      triggered: flag.triggered,
      severity: flag.severity,
    })),
    disclaimer: FRAUD_MODEL.disclaimer,
    limitations: FRAUD_LIMITATIONS,
  };
};

const loadProperty = async (propertyId) => {
  if (!propertyId || !/^[a-f\d]{24}$/i.test(propertyId)) {
    throw new ApiError(400, 'A valid property id is required to run screening.', 'INVALID_PROPERTY_ID');
  }

  const property = await Property.findById(propertyId).lean();

  if (!property) {
    throw new ApiError(404, 'Property not found.', 'PROPERTY_NOT_FOUND');
  }

  return property;
};

/**
 * Convenience entry point for stored listings: load the property, value it with
 * the existing valuation service, then screen it. Nothing is persisted, so a
 * benchmark change immediately changes the screening result.
 */
export const screenStoredProperty = async (propertyId) => {
  if (!isDatabaseReady()) {
    throw databaseUnavailable();
  }

  const property = await loadProperty(propertyId);

  let valuation = null;
  let marketDataError = null;

  try {
    valuation = await valueStoredProperty(propertyId);
  } catch (error) {
    if (error.code !== 'INSUFFICIENT_MARKET_DATA') {
      throw error;
    }
    marketDataError = error;
  }

  const assessment = await analyzeProperty(property, valuation);

  // Only fields already visible on the public listing response are exposed, so a
  // screening response can never reveal seller information.
  const propertySummary = {
    id: property._id.toString(),
    title: property.title,
    locality: property.locality,
    city: property.city,
    propertyType: property.propertyType,
    askingPrice: property.askingPrice,
  };

  if (marketDataError) {
    const priceFlag = assessment.flags.find((flag) => flag.type === 'PRICE_DEVIATION');
    const duplicateFlag = assessment.flags.find((flag) => flag.type === 'DUPLICATE_LISTING');
    // Never hide a real duplicate finding behind a missing benchmark, but never
    // report a risk level that leaned on a check which could not run.
    const duplicateOnlyResult = !priceFlag.triggered && duplicateFlag.triggered;
    const unavailableNote =
      'Pricing screening was unavailable for this listing because PropIQ has no current market benchmark for its location.';

    return {
      ...assessment,
      property: propertySummary,
      status: duplicateOnlyResult ? assessment.status : 'unavailable',
      riskLevel: duplicateOnlyResult ? assessment.riskLevel : null,
      summary: duplicateOnlyResult ? `${assessment.summary} ${unavailableNote}` : unavailableNote,
      partial: true,
      valuation: null,
      valuationUnavailable: {
        code: marketDataError.code,
        reason: marketDataError.message,
        searched: marketDataError.details?.searched ?? [],
      },
    };
  }

  return {
    ...assessment,
    property: propertySummary,
    valuationUnavailable: null,
    valuation: {
      estimatedValue: valuation.estimatedValue,
      estimatedPricePerSqFt: valuation.estimatedPricePerSqFt,
      benchmarkPricePerSqFt: valuation.benchmarkPricePerSqFt,
      baseValue: valuation.baseValue,
      amenityAdjustment: valuation.amenityAdjustment,
      ageAdjustment: valuation.ageAdjustment,
      confidence: valuation.confidence,
      marketData: valuation.marketData,
      explanation: valuation.explanation,
      disclaimer: valuation.disclaimer,
    },
  };
};
