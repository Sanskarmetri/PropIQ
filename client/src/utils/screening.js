import { Scale, Copy } from 'lucide-react';
import { formatCompactCurrency, formatSignedPercent } from './formatters.js';

/** Human label for each screening outcome, used for the panel badge. */
export const SCREENING_STATUS_LABEL = {
  clear: 'No flags raised',
  review: 'Review recommended',
  elevated: 'Elevated attention',
  unavailable: 'Pricing check unavailable',
};

/**
 * Why each rule matters, shown only when the rule actually fired. Both notes stay
 * neutral on purpose: a flag means a listing deserves a second look, not that
 * anything dishonest has happened.
 */
export const SCREENING_RULE_MATTERS = {
  PRICE_DEVIATION:
    'A price far from the estimate can point to a mispriced listing, a stale benchmark, or a data entry error. Worth confirming before you commit.',
  DUPLICATE_LISTING:
    'Two live listings for the same home split attention and can mislead buyers, so one of them is usually out of date.',
};

export const SCREENING_RULE_ICON = {
  PRICE_DEVIATION: Scale,
  DUPLICATE_LISTING: Copy,
};

/**
 * Turns one screening flag into a single evidence line. Every value shown here
 * comes straight from the API payload, so the card can never claim more than the
 * rules actually proved.
 */
export const screeningFact = (flag) => {
  if (!flag.evaluated || !flag.details) return 'Not evaluated for this listing';

  if (flag.type === 'PRICE_DEVIATION') {
    const { askingPrice, estimatedValue, deviationPercentage, threshold, direction } = flag.details;
    return `${formatSignedPercent(deviationPercentage / 100)} ${direction} the ${formatCompactCurrency(estimatedValue)} estimate (${formatCompactCurrency(askingPrice)}, ${threshold}% threshold)`;
  }

  const { matchScore, matchingPropertyIds, candidatesCompared } = flag.details;
  if (matchScore === null) {
    return `No match across ${candidatesCompared} comparable listing${candidatesCompared === 1 ? '' : 's'}`;
  }
  return `${matchScore}% match on ${matchingPropertyIds.length} listing${matchingPropertyIds.length === 1 ? '' : 's'} (${candidatesCompared} compared)`;
};
