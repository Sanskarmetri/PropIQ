import { formatCurrency, formatNumber } from '../../utils/formatCurrency.js';
import {
  ACTIONS,
  INTENTS,
  capabilitiesForRole,
  suggestionsForRole,
} from './intentDefinitions.js';

export const MESSAGES = {
  greeting: "Hi 👋 Welcome to PropVal. We're ready to help you find your dream property.",
  unknown: 'I can help you find properties, estimate value, compare asking prices, or review listing screening.',
  noResults: "I couldn't find properties matching those filters.",
  noSimilar: "I couldn't find any similar listings right now.",
  propertyNotFound: "I couldn't find that property in PropIQ.",
  detailsContext: 'I can show property details once you open a property.',
  valuationContext:
    "Open a property first and I'll value it, or share a locality, property type and built-up area.",
  screeningContext: "Open a property first and I'll compare its asking price with the PropIQ estimate.",
  fraudContext: "Open a property first and I'll explain any screening flags on it.",
  similarContext: "Open a property first and I'll show you similar listings.",
  benchmarkUnavailable:
    "PropIQ doesn't have a current market benchmark for this location yet, so I can't produce a valuation right now.",
  comparisonUnavailable:
    "PropIQ has no current market benchmark for this listing's location, so I can't compare the asking price yet.",
  analyticsForbidden:
    'Listing analytics cover every listing in PropIQ, so they are limited to admin accounts. Sign in as an admin to ask.',
  analyticsEmpty:
    "No listings in PropIQ match that scope, so there are no analytics to show. Try a different city, locality or property type.",
};

const NEUTRAL_FLAG_NAMES = {
  PRICE_DEVIATION: 'pricing anomaly',
  DUPLICATE_LISTING: 'duplicate listing match',
};

const trimTrailingZero = (value) => Number(value.toFixed(1)).toString();

/**
 * Indian short scale, matching how the rest of PropIQ talks about money.
 */
const formatCompactInr = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '';
  }
  if (amount >= 10000000) {
    return `₹${trimTrailingZero(amount / 10000000)} crore`;
  }
  if (amount >= 100000) {
    return `₹${trimTrailingZero(amount / 100000)} lakh`;
  }
  return formatCurrency(amount);
};

const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`;

const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

const capitalise = (word) => word.charAt(0).toUpperCase() + word.slice(1);

const areaSentence = (minArea, maxArea) => {
  if (minArea !== undefined && minArea !== maxArea) {
    return ` between ${formatNumber(minArea)} and ${formatNumber(maxArea)} sq ft`;
  }
  const area = minArea ?? maxArea;
  return area !== undefined ? ` around ${formatNumber(area)} sq ft` : '';
};

const budgetSentence = ({ minPrice, maxPrice }) => {
  if (minPrice !== undefined && minPrice !== maxPrice) {
    return ` between ${formatCompactInr(minPrice)} and ${formatCompactInr(maxPrice)}`;
  }
  const price = minPrice ?? maxPrice;
  return price !== undefined ? ` under ${formatCompactInr(price)}` : '';
};

const describeFilters = (entities) => {
  const place = entities.locality ?? entities.city;
  return `${place ? ` in ${place}` : ''}${entities.propertyType ? ` · ${entities.propertyType}` : ''}${
    entities.bedrooms !== undefined ? ` · ${entities.bedrooms} bed` : ''
  }${budgetSentence(entities)}${areaSentence(entities.minArea, entities.maxArea)}${
    entities.amenities?.length ? ` · ${entities.amenities.join(', ')}` : ''
  }`;
};

const searchMessage = (results, total, entities) => {
  if (results.length === 0) {
    return MESSAGES.noResults;
  }
  const head = total > results.length ? `Found ${results.length} of ${total} properties` : `Found ${results.length} ${results.length === 1 ? 'property' : 'properties'}`;
  return `${head}${describeFilters(entities)}.`;
};

const valuationMessage = (valuation, property) => {
  if (!valuation) {
    return MESSAGES.benchmarkUnavailable;
  }

  const askingShare =
    property && Number.isFinite(property.askingPrice) && valuation.estimatedValue > 0
      ? ` The asking price is ${Math.round((property.askingPrice / valuation.estimatedValue) * 100)}% of that estimate.`
      : '';

  return `The PropIQ estimate is ${formatCompactInr(valuation.estimatedValue)} (${formatCurrency(
    valuation.estimatedPricePerSqFt,
  )} per sq ft).${askingShare}`;
};

const triggeredFlags = (screening) => (screening?.flags ?? []).filter((flag) => flag.triggered);

const priceComparisonMessage = (screening, unavailable) => {
  if (unavailable) {
    return MESSAGES.comparisonUnavailable;
  }
  const priceFlag = screening?.flags?.find((flag) => flag.type === 'PRICE_DEVIATION');
  if (priceFlag) {
    return priceFlag.message;
  }
  return screening?.summary ?? MESSAGES.comparisonUnavailable;
};

const screeningExplanationMessage = (screening, unavailable) => {
  if (unavailable && !screening) {
    return MESSAGES.benchmarkUnavailable;
  }

  const flags = triggeredFlags(screening);
  if (flags.length === 0) {
    return screening?.summary ?? MESSAGES.comparisonUnavailable;
  }

  const lines = flags.map(
    (flag) => `• ${NEUTRAL_FLAG_NAMES[flag.type] ?? flag.title}: ${flag.message}`,
  );
  return `${screening.summary} ${lines.join(' ')}`;
};

const similarMessage = (results, matchingFields) => {
  if (results.length === 0) {
    return MESSAGES.noSimilar;
  }
  const head = `Found ${plural(results.length, 'similar listing', 'similar listings')}`;
  return matchingFields.length > 0
    ? `${head} matching on ${matchingFields.join(', ')}.`
    : `${head} in the same area.`;
};

/**
 * Reads the requested scope as a phrase that can sit inside a sentence, so an
 * unfiltered question reads as plainly as a filtered one.
 */
const scopePhrase = (scope = {}) => {
  const place = scope.locality ?? scope.city;
  if (place) {
    return ` in ${place}`;
  }
  return scope.propertyType ? ` across ${scope.propertyType} listings` : '';
};

/**
 * Aggregate wording for the analytics payload. Every figure is read from the
 * analytics service response, and an empty result says so plainly rather than
 * reporting zeros that mean "nothing matched".
 */
const analyticsMessage = (analytics, scope) => {
  if (!analytics || analytics.kpis.empty) {
    return MESSAGES.analyticsEmpty;
  }

  const { kpis, breakdowns, screening } = analytics;
  const lines = [
    `PropIQ holds ${plural(kpis.totalListings, 'listing', 'listings')}${scopePhrase(scope)}, of which ${
      kpis.activeListings === 0
        ? 'none are active'
        : `${kpis.activeListings} ${kpis.activeListings === 1 ? 'is' : 'are'} active`
    }.`,
    `The average asking price is ${formatCompactInr(kpis.averageAskingPrice)} (median ${formatCompactInr(
      kpis.medianAskingPrice,
    )}) at an average of ${formatCurrency(kpis.averagePricePerSqFt)} per sq ft.`,
  ];

  const leadingCity = breakdowns.cities[0];
  if (leadingCity) {
    lines.push(`${leadingCity.city} holds the most listings, with ${plural(leadingCity.listings, 'listing', 'listings')}.`);
  }

  const leadingType = breakdowns.propertyTypes[0];
  if (leadingType) {
    lines.push(
      leadingType.listings === 1
        ? `The only listing in this scope is ${article(leadingType.propertyType)} ${leadingType.propertyType}.`
        : `${capitalise(leadingType.propertyType)} is the most common type, with ${plural(leadingType.listings, 'listing', 'listings')}.`,
    );
  }

  const { review, elevated, unavailable } = screening.byStatus;
  if (review + elevated > 0) {
    lines.push(
      `Screening flagged ${review + elevated} listing${review + elevated === 1 ? '' : 's'} for review (${review} to review, ${elevated} elevated).`,
    );
  } else {
    lines.push('Screening raised no pricing or duplicate flags in this scope.');
  }

  if (unavailable > 0) {
    lines.push(
      `${plural(unavailable, 'listing', 'listings')} could not be screened because PropIQ has no market benchmark for their location.`,
    );
  }

  if (screening.coverage.capped) {
    lines.push(screening.note);
  }

  return lines.join(' ');
};

/**
 * Stage four of the pipeline: turns a routing outcome into the exact wording the
 * client shows. Every number in these messages comes from a service payload, and
 * screening wording stays neutral and review-oriented.
 */
export const buildResponse = ({ intent, entities = {}, outcome = {}, context = {}, viewer = {} } = {}) => {
  const base = {
    intent,
    action: outcome.action ?? ACTIONS.NONE,
    entities,
    results: [],
    context: {
      currentRoute: context.currentRoute ?? null,
      currentPropertyId: context.currentPropertyId ?? null,
      lastSearch: context.lastSearch ?? null,
      lastSearchResultCount: context.lastSearchResultCount ?? null,
    },
  };

  const suggestions = suggestionsForRole(viewer.role);

  /**
   * Intents that promise a valuation or screening payload keep the key present
   * with a null value, so the client never has to guess whether the field is
   * missing or simply not applicable.
   */
  const emptyPayload = {
    [INTENTS.VALUATION]: { valuation: null },
    [INTENTS.PRICE_ANALYSIS]: { valuation: null, screening: null },
    [INTENTS.FRAUD_EXPLANATION]: { valuation: null, screening: null },
    [INTENTS.MARKET_ANALYTICS]: { analytics: null, analyticsScope: null, analyticsForbidden: false },
  };

  if (intent === INTENTS.GREETING) {
    return { ...base, message: MESSAGES.greeting, suggestions };
  }

  if (intent === INTENTS.HELP) {
    return {
      ...base,
      message: `I can ${capabilitiesForRole(viewer.role).map((item) => item.toLowerCase()).join(', I can ')}.`,
      suggestions,
    };
  }

  if (intent === INTENTS.UNKNOWN) {
    return { ...base, message: MESSAGES.unknown, suggestions };
  }

  if (outcome.forbidden) {
    return {
      ...base,
      ...(emptyPayload[intent] ?? {}),
      analyticsForbidden: true,
      message: MESSAGES.analyticsForbidden,
      suggestions,
    };
  }

  if (outcome.notFound) {
    return { ...base, message: MESSAGES.propertyNotFound, ...(emptyPayload[intent] ?? {}) };
  }

  if (outcome.missingContext) {
    const messages = {
      [INTENTS.PROPERTY_DETAILS]: MESSAGES.detailsContext,
      [INTENTS.VALUATION]: MESSAGES.valuationContext,
      [INTENTS.PRICE_ANALYSIS]: MESSAGES.screeningContext,
      [INTENTS.FRAUD_EXPLANATION]: MESSAGES.fraudContext,
      [INTENTS.SIMILAR_PROPERTIES]: MESSAGES.similarContext,
    };
    return {
      ...base,
      ...(emptyPayload[intent] ?? {}),
      message: messages[intent] ?? MESSAGES.unknown,
    };
  }

  if (base.action === ACTIONS.PROPERTY_SEARCH) {
    const results = outcome.results ?? [];
    return {
      ...base,
      message: searchMessage(results, outcome.total ?? results.length, entities),
      results,
      total: outcome.total ?? results.length,
    };
  }

  if (base.action === ACTIONS.PROPERTY_DETAILS) {
    return {
      ...base,
      message: `Here are the PropIQ details for ${outcome.property.title}.`,
      results: [outcome.property],
      property: outcome.property,
    };
  }

  if (base.action === ACTIONS.VALUATION) {
    return {
      ...base,
      message: valuationMessage(outcome.valuation, outcome.property),
      results: outcome.property ? [outcome.property] : [],
      property: outcome.property ?? null,
      valuation: outcome.valuation ?? null,
    };
  }

  if (base.action === ACTIONS.FRAUD_SCREENING) {    const isExplanation = intent === INTENTS.FRAUD_EXPLANATION;
    return {
      ...base,
      message: isExplanation
        ? screeningExplanationMessage(outcome.screening, outcome.unavailable)
        : priceComparisonMessage(outcome.screening, outcome.unavailable),
      results: outcome.property ? [outcome.property] : [],
      property: outcome.property ?? null,
      valuation: outcome.valuation ?? null,
      screening: outcome.screening ?? null,
    };
  }

  if (base.action === ACTIONS.SIMILAR_PROPERTIES) {    const results = outcome.results ?? [];
    return {
      ...base,
      message: similarMessage(results, outcome.matchingFields ?? []),
      results,
      matchingFields: outcome.matchingFields ?? [],
    };
  }

  if (base.action === ACTIONS.MARKET_ANALYTICS) {
    const analytics = outcome.analytics ?? null;
    return {
      ...base,
      message: analyticsMessage(analytics, outcome.scope ?? {}),
      analytics,
      analyticsScope: outcome.scope ?? null,
      analyticsForbidden: false,
      // Flagged listings are ordinary listings, so the existing listing card
      // renders them without any new client shape.
      results: analytics?.screening?.flaggedListings ?? [],
    };
  }

  return { ...base, message: MESSAGES.unknown, suggestions };
};
