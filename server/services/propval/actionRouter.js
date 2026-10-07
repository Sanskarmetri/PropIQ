import { getAnalyticsOverview, parseAnalyticsFilters } from '../analyticsService.js';
import { findSimilarListings } from '../duplicateDetectionService.js';
import { searchProperties } from '../propertyService.js';
import { screenStoredProperty } from '../fraudService.js';
import { valueProperty, valueStoredProperty } from '../valuationService.js';
import { INTENTS, INTENT_ACTIONS, ACTIONS } from './intentDefinitions.js';

export { ACTIONS };

const SEARCH_RESULT_LIMIT = 6;
const SIMILAR_RESULT_LIMIT = 4;
const MARKET_DATA_UNAVAILABLE = 'INSUFFICIENT_MARKET_DATA';

const searchFiltersFrom = (entities, amenityKeywords) => ({
  ...(entities.locality ? { locality: entities.locality } : {}),
  ...(entities.city ? { city: entities.city } : {}),
  ...(entities.propertyType ? { propertyType: entities.propertyType } : {}),
  ...(entities.bedrooms !== undefined ? { bedrooms: entities.bedrooms } : {}),
  ...(entities.minPrice !== undefined ? { minPrice: entities.minPrice } : {}),
  ...(entities.maxPrice !== undefined ? { maxPrice: entities.maxPrice } : {}),
  ...(entities.minArea !== undefined ? { minArea: entities.minArea } : {}),
  ...(entities.maxArea !== undefined ? { maxArea: entities.maxArea } : {}),
  ...(amenityKeywords?.length ? { amenities: amenityKeywords } : {}),
  limit: SEARCH_RESULT_LIMIT,
});

/**
 * Inline valuation needs enough detail to be meaningful. Anything less would
 * force PropVal to invent characteristics, so it asks for a property instead.
 */
const inlineValuationInput = (entities) => {
  const builtUpArea =
    entities.minArea !== undefined && entities.minArea === entities.maxArea ? entities.minArea : undefined;

  if (!entities.locality || !entities.propertyType || !builtUpArea) {
    return null;
  }

  return {
    locality: entities.locality,
    city: entities.city,
    propertyType: entities.propertyType,
    builtUpArea,
    bedrooms: entities.bedrooms ?? 0,
    bathrooms: entities.bathrooms ?? 0,
    ...(entities.amenities?.length ? { amenities: entities.amenities } : {}),
  };
};

const runValuation = async (propertyId, entities) => {
  if (propertyId) {
    try {
      return { valuation: await valueStoredProperty(propertyId) };
    } catch (error) {
      if (error.code !== MARKET_DATA_UNAVAILABLE) {
        throw error;
      }
      return { valuation: null, unavailable: true };
    }
  }

  const input = inlineValuationInput(entities);
  if (!input) {
    return { missingContext: true };
  }

  try {
    return { valuation: await valueProperty(input) };
  } catch (error) {
    if (error.code !== MARKET_DATA_UNAVAILABLE) {
      throw error;
    }
    return { valuation: null, unavailable: true };
  }
};

const runScreening = async (propertyId) => {
  try {
    const screening = await screenStoredProperty(propertyId);
    return { screening, valuation: screening.valuation ?? null, unavailable: Boolean(screening.valuationUnavailable) };
  } catch (error) {
    if (error.code !== MARKET_DATA_UNAVAILABLE) {
      throw error;
    }
    return { screening: null, valuation: null, unavailable: true };
  }
};

/**
 * Similar listings reuse the duplicate match scorer for ranking, then top the
 * set up with other listings from the same locality and property type. The
 * fraud wording of the screening report is never used here.
 */
const runSimilarProperties = async (property, limit) => {
  const similar = await findSimilarListings(property, { limit });
  const rankedIds = new Set(similar.matchingPropertyIds);
  rankedIds.add(property.id ?? property._id.toString());

  const results = similar.matches.map((match) => ({ ...match, matchScore: match.matchScore }));

  if (results.length < limit) {
    const nearby = await searchProperties({
      locality: property.locality,
      city: property.city,
      propertyType: property.propertyType,
      limit: limit + rankedIds.size,
    });

    for (const candidate of nearby.properties) {
      if (results.length >= limit) {
        break;
      }
      if (rankedIds.has(candidate.id)) {
        continue;
      }
      rankedIds.add(candidate.id);
      results.push({ ...candidate, matchScore: null });
    }
  }

  return { results: results.slice(0, limit), matchingFields: similar.matchingFields };
};

/**
 * Analytics answer from the same service the admin dashboard calls, so a PropVal
 * figure and a dashboard figure can never disagree. Only the filters the entity
 * parser can resolve are forwarded: place and property type. A budget in the
 * message is ignored here rather than guessed at, because the analytics
 * aggregates cover the whole collection rather than a price band.
 */
const runMarketAnalytics = async (entities) => {
  const filters = parseAnalyticsFilters({
    city: entities.city,
    locality: entities.locality,
    propertyType: entities.propertyType,
  });

  const analytics = await getAnalyticsOverview(filters);
  return { analytics, scope: filters.applied };
};

const routes = {
  [INTENTS.GREETING]: async () => ({ action: ACTIONS.NONE }),
  [INTENTS.HELP]: async () => ({ action: ACTIONS.NONE }),
  [INTENTS.UNKNOWN]: async () => ({ action: ACTIONS.NONE }),

  [INTENTS.PROPERTY_SEARCH]: async ({ entities, amenityKeywords }) => {
    const { properties, pagination } = await searchProperties(searchFiltersFrom(entities, amenityKeywords));
    return { action: ACTIONS.PROPERTY_SEARCH, results: properties, total: pagination.total };
  },

  [INTENTS.PROPERTY_DETAILS]: async ({ propertyId, property }) => {
    if (!propertyId) {
      return { action: ACTIONS.PROPERTY_DETAILS, missingContext: true };
    }
    if (!property) {
      return { action: ACTIONS.PROPERTY_DETAILS, notFound: true };
    }
    return { action: ACTIONS.PROPERTY_DETAILS, property };
  },

  [INTENTS.VALUATION]: async ({ propertyId, property, entities }) => ({
    action: ACTIONS.VALUATION,
    property,
    ...(await runValuation(propertyId, entities)),
  }),

  [INTENTS.PRICE_ANALYSIS]: async ({ propertyId, property }) => {
    if (!propertyId) {
      return { action: ACTIONS.FRAUD_SCREENING, missingContext: true };
    }
    if (!property) {
      return { action: ACTIONS.FRAUD_SCREENING, notFound: true };
    }

    // Screening already values the listing with the PropIQ valuation service, so
    // the comparison reuses that estimate instead of pricing the property twice.
    return { action: ACTIONS.FRAUD_SCREENING, property, ...(await runScreening(propertyId)) };
  },

  [INTENTS.FRAUD_EXPLANATION]: async ({ propertyId, property }) => {
    if (!propertyId) {
      return { action: ACTIONS.FRAUD_SCREENING, missingContext: true };
    }
    if (!property) {
      return { action: ACTIONS.FRAUD_SCREENING, notFound: true };
    }

    const { screening, valuation, unavailable } = await runScreening(propertyId);
    return { action: ACTIONS.FRAUD_SCREENING, property, screening, valuation, unavailable };
  },

  [INTENTS.SIMILAR_PROPERTIES]: async ({ propertyId, property }) => {
    if (!propertyId) {
      return { action: ACTIONS.SIMILAR_PROPERTIES, missingContext: true };
    }
    if (!property) {
      return { action: ACTIONS.SIMILAR_PROPERTIES, notFound: true };
    }

    return {
      action: ACTIONS.SIMILAR_PROPERTIES,
      property,
      ...(await runSimilarProperties(property, SIMILAR_RESULT_LIMIT)),
    };
  },

  [INTENTS.MARKET_ANALYTICS]: async ({ entities }) => ({
    action: ACTIONS.MARKET_ANALYTICS,
    ...(await runMarketAnalytics(entities)),
  }),
};

/**
 * Stage three of the pipeline: the only place that calls PropIQ services.
 * Returns a plain outcome object; wording is applied later by the response
 * builder so parsing and routing stay free of presentation.
 */
export const routeIntent = async ({ intent, entities = {}, amenityKeywords = [], propertyId = null, property = null }) => {
  const handler = routes[intent];
  if (!handler) {
    return { action: INTENT_ACTIONS[intent] ?? ACTIONS.NONE, missingContext: true };
  }

  return handler({ intent, entities, amenityKeywords, propertyId, property });
};
