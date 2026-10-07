import mongoose from 'mongoose';
import { Property } from '../models/Property.js';

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const serializeProperty = (property) => {
  const plain = typeof property.toObject === 'function' ? property.toObject({ virtuals: true }) : { ...property };
  return { ...plain, id: plain._id.toString() };
};

const exactMatch = (value) => new RegExp(`^${escapeRegExp(value)}$`, 'i');

/**
 * Builds the Mongo filter for a public property search.
 *
 * Every value is either coerced to a number, checked against a model enum, or
 * escaped inside a regular expression, so request input can never introduce a
 * MongoDB operator.
 */
export const buildPropertyFilter = (query = {}) => {
  const filter = {};

  if (query.locality) {
    filter.locality = exactMatch(query.locality);
  }
  if (query.city) {
    filter.city = exactMatch(query.city);
  }
  if (query.propertyType) {
    filter.propertyType = query.propertyType;
  }
  if (query.status) {
    filter.status = query.status;
  } else {
    filter.status = { $in: ['active', 'sold'] };
  }
  if (query.bedrooms !== null && query.bedrooms !== undefined) {
    filter.bedrooms = query.bedrooms;
  }

  if (query.minPrice !== null && query.minPrice !== undefined) {
    filter.askingPrice = { ...filter.askingPrice, $gte: query.minPrice };
  }
  if (query.maxPrice !== null && query.maxPrice !== undefined) {
    filter.askingPrice = { ...filter.askingPrice, $lte: query.maxPrice };
  }

  if (query.minArea !== null && query.minArea !== undefined) {
    filter.builtUpArea = { ...filter.builtUpArea, $gte: query.minArea };
  }
  if (query.maxArea !== null && query.maxArea !== undefined) {
    filter.builtUpArea = { ...filter.builtUpArea, $lte: query.maxArea };
  }

  if (query.amenities) {
    const amenities = query.amenities
      .map((amenity) => escapeRegExp(amenity))
      .filter((amenity) => amenity !== '');
    if (amenities.length > 0) {
      filter.amenities = { $all: amenities.map((amenity) => new RegExp(amenity, 'i')) };
    }
  }

  if (query.search) {
    const search = new RegExp(escapeRegExp(query.search), 'i');
    filter.$or = [{ title: search }, { locality: search }, { city: search }];
  }

  return filter;
};

/**
 * Runs a public property search and returns serialized listings plus totals.
 * Shared by the REST controller and the PropVal action router.
 */
export const searchProperties = async (query = {}) => {
  const filter = buildPropertyFilter(query);
  const page = Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
  const limit = Number.isInteger(query.limit) && query.limit > 0 ? Math.min(query.limit, 50) : 12;
  const skip = (page - 1) * limit;

  const [properties, total] = await Promise.all([
    Property.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Property.countDocuments(filter),
  ]);

  return {
    properties: properties.map(serializeProperty),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

/**
 * Loads a single property for public detail views and PropVal lookups.
 * Returns null when the id is malformed or the property does not exist.
 */
export const findPropertyById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }
  const property = await Property.findById(id).lean();
  return property ? serializeProperty(property) : null;
};

/**
 * Resolves a place name used in a message against the stored listings.
 *
 * Returns the canonical locality and city when the name is one PropIQ already
 * knows, `{ city }` when it names a known city, and null when it matches
 * nothing, so callers can report the name back untouched instead of guessing.
 */
export const resolvePlaceReference = async (place) => {
  if (!place) {
    return null;
  }

  const asLocality = await Property.findOne({ locality: exactMatch(place) })
    .select({ locality: 1, city: 1 })
    .lean();
  if (asLocality) {
    return { locality: asLocality.locality, city: asLocality.city };
  }

  const asCity = await Property.findOne({ city: exactMatch(place) })
    .select({ city: 1 })
    .lean();
  return asCity ? { city: asCity.city } : null;
};
