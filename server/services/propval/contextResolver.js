import mongoose from 'mongoose';
import { isDatabaseReady } from '../../config/db.js';
import { findPropertyById, resolvePlaceReference } from '../propertyService.js';

/**
 * PropVal context is deliberately small: the page the user is on, the property
 * they are looking at, and the last search they ran. There is no long-term
 * memory and no per-user conversation store.
 */
export const normalizeContext = (context = {}) => {
  const source = context && typeof context === 'object' && !Array.isArray(context) ? context : {};
  const currentPropertyId =
    typeof source.currentPropertyId === 'string' && mongoose.isValidObjectId(source.currentPropertyId)
      ? source.currentPropertyId
      : null;

  const lastSearch =
    source.lastSearch && typeof source.lastSearch === 'object' && !Array.isArray(source.lastSearch)
      ? source.lastSearch
      : null;

  const lastSearchResultCount = Number.isInteger(source.lastSearchResultCount)
    ? source.lastSearchResultCount
    : null;

  return {
    currentRoute: typeof source.currentRoute === 'string' ? source.currentRoute.slice(0, 200) : null,
    currentPropertyId,
    lastSearch,
    lastSearchResultCount,
  };
};

/**
 * Turns a place reference such as "whitefield" into the city and locality the
 * database actually knows about.
 *
 * Resolution is data driven. A name PropIQ has never seen is returned untouched
 * as a locality filter, so the query honestly returns zero results instead of
 * guessing at a location.
 */
const resolvePlace = async (place) => {
  if (!place) {
    return {};
  }

  if (!isDatabaseReady()) {
    return { locality: place };
  }

  try {
    return (await resolvePlaceReference(place)) ?? { locality: place };
  } catch {
    return { locality: place };
  }
};

/**
 * Stage two of the pipeline: combines parsed entities with request context and
 * loads the property the user is currently viewing, when one exists.
 */
export const resolveContext = async ({ entities = {}, context = {} }) => {
  const normalized = normalizeContext(context);
  const resolved = { ...entities };

  const place = resolved.place;
  delete resolved.place;

  const placeResolution = place ? await resolvePlace(place) : {};
  if (placeResolution.locality !== undefined) {
    resolved.locality = placeResolution.locality;
  }
  if (placeResolution.city !== undefined) {
    resolved.city = placeResolution.city;
  }

  const propertyId = resolved.propertyId ?? normalized.currentPropertyId;
  const property = propertyId && isDatabaseReady() ? await findPropertyById(propertyId) : null;

  if (!resolved.locality && !resolved.city && property) {
    resolved.city = property.city;
  }

  return {
    entities: resolved,
    context: { ...normalized, currentPropertyId: propertyId ?? null, currentProperty: property },
    property,
    propertyId: propertyId ?? null,
  };
};
