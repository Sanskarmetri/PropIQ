import { ApiError } from './ApiError.js';
import { DEFAULT_PROPERTY_STATUS, PROPERTY_STATUSES, PROPERTY_TYPES } from '../models/Property.js';

const MAX_AMENITIES = 20;
const MAX_IMAGES = 8;
const MAX_BUILT_UP_AREA = 10000000;
const MAX_ASKING_PRICE = 10000000000;

const LIMITS = {
  title: { min: 3, max: 160 },
  description: { max: 2000 },
  locality: { min: 2, max: 120 },
  city: { min: 2, max: 80 },
  bedrooms: { max: 50 },
  bathrooms: { max: 50 },
  propertyAge: { max: 200 },
};

const readText = (value) => (typeof value === 'string' ? value.trim() : '');

const parseNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const invalidBody = () => new ApiError(400, 'Request body must be a JSON object.', 'INVALID_BODY');

const validationFailed = (details) =>
  new ApiError(400, 'Please correct the highlighted property fields.', 'PROPERTY_VALIDATION_FAILED', details);

const validateText = (errors, field, value, { required, label, limits }) => {
  if (value === undefined) {
    if (required) errors[field] = `${label} is required`;
    return undefined;
  }
  if (typeof value !== 'string') {
    errors[field] = `${label} must be text`;
    return undefined;
  }

  const text = value.trim();
  if (text.length < limits.min) {
    errors[field] = `${label} must be at least ${limits.min} characters long`;
    return undefined;
  }
  if (text.length > limits.max) {
    errors[field] = `${label} must be ${limits.max} characters or fewer`;
    return undefined;
  }

  return text;
};

const validateNumber = (errors, field, value, { required, label, min, max }) => {
  if (value === undefined || value === null || value === '') {
    if (required) errors[field] = `${label} is required`;
    return undefined;
  }

  const parsed = parseNumber(value);
  if (parsed === null) {
    errors[field] = `${label} must be a number`;
    return undefined;
  }
  if (!Number.isInteger(parsed)) {
    errors[field] = `${label} must be a whole number`;
    return undefined;
  }
  if (parsed < min) {
    errors[field] = min === 1 ? `${label} must be greater than 0` : `${label} must be ${min} or more`;
    return undefined;
  }
  if (parsed > max) {
    errors[field] = `${label} looks unrealistic`;
    return undefined;
  }

  return parsed;
};

const validateAmenities = (errors, value) => {
  if (value === undefined || value === null) return undefined;

  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : null;

  if (!raw) {
    errors.amenities = 'Amenities must be a list of short labels';
    return undefined;
  }

  const amenities = raw.map((item) => readText(item)).filter(Boolean);
  if (amenities.length > MAX_AMENITIES) {
    errors.amenities = `Use at most ${MAX_AMENITIES} amenities`;
    return undefined;
  }
  if (amenities.some((amenity) => amenity.length > 60)) {
    errors.amenities = 'Each amenity must be 60 characters or fewer';
    return undefined;
  }

  return amenities;
};

const validateImages = (errors, value) => {
  if (value === undefined || value === null) return undefined;

  if (!Array.isArray(value)) {
    errors.images = 'Images must be a list of image URLs';
    return undefined;
  }
  if (value.length > MAX_IMAGES) {
    errors.images = `Use at most ${MAX_IMAGES} images`;
    return undefined;
  }
  if (value.some((image) => typeof image !== 'string' || !/^https?:\/\//.test(image))) {
    errors.images = 'Each image must be an http(s) URL';
    return undefined;
  }

  return value;
};

export const validatePropertyInput = (body, { partial = false } = {}) => {
  if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidBody();
  }

  const errors = {};
  const payload = {};

  const title = validateText(errors, 'title', body.title, {
    required: !partial,
    label: 'Property title',
    limits: LIMITS.title,
  });
  if (title !== undefined) payload.title = title;

  const description = validateText(errors, 'description', body.description, {
    required: false,
    label: 'Property description',
    limits: LIMITS.description,
  });
  if (description !== undefined) payload.description = description;

  const locality = validateText(errors, 'locality', body.locality, {
    required: !partial,
    label: 'Locality',
    limits: LIMITS.locality,
  });
  if (locality !== undefined) payload.locality = locality;

  const city = validateText(errors, 'city', body.city, {
    required: !partial,
    label: 'City',
    limits: LIMITS.city,
  });
  if (city !== undefined) payload.city = city;

  if (body.propertyType !== undefined) {
    const propertyType = readText(body.propertyType).toLowerCase();
    if (!PROPERTY_TYPES.includes(propertyType)) {
      errors.propertyType = `Property type must be one of: ${PROPERTY_TYPES.join(', ')}`;
    } else {
      payload.propertyType = propertyType;
    }
  } else if (!partial) {
    errors.propertyType = 'Property type is required';
  }

  if (body.status !== undefined) {
    const status = readText(body.status).toLowerCase();
    if (!PROPERTY_STATUSES.includes(status)) {
      errors.status = `Status must be one of: ${PROPERTY_STATUSES.join(', ')}`;
    } else {
      payload.status = status;
    }
  } else if (!partial) {
    payload.status = DEFAULT_PROPERTY_STATUS;
  }

  const builtUpArea = validateNumber(errors, 'builtUpArea', body.builtUpArea, {
    required: !partial,
    label: 'Built-up area',
    min: 1,
    max: MAX_BUILT_UP_AREA,
  });
  if (builtUpArea !== undefined) payload.builtUpArea = builtUpArea;

  const askingPrice = validateNumber(errors, 'askingPrice', body.askingPrice, {
    required: !partial,
    label: 'Asking price',
    min: 1,
    max: MAX_ASKING_PRICE,
  });
  if (askingPrice !== undefined) payload.askingPrice = askingPrice;

  for (const field of ['bedrooms', 'bathrooms', 'propertyAge']) {
    const parsed = validateNumber(errors, field, body[field], {
      required: false,
      label: field === 'bedrooms' ? 'Bedrooms' : field === 'bathrooms' ? 'Bathrooms' : 'Property age',
      min: 0,
      max: LIMITS[field].max,
    });
    if (parsed !== undefined) payload[field] = parsed;
  }

  const amenities = validateAmenities(errors, body.amenities);
  if (amenities !== undefined) payload.amenities = amenities;

  const images = validateImages(errors, body.images);
  if (images !== undefined) payload.images = images;

  if (Object.keys(errors).length > 0) {
    throw validationFailed(errors);
  }

  return payload;
};

export const parseListQuery = (query = {}) => {
  const errors = {};

  const page = parseNumber(query.page);
  const limit = parseNumber(query.limit);
  const minPrice = parseNumber(query.minPrice);
  const maxPrice = parseNumber(query.maxPrice);
  const minArea = parseNumber(query.minArea);
  const maxArea = parseNumber(query.maxArea);
  const bedrooms = parseNumber(query.bedrooms);

  if (query.page !== undefined && (page === null || !Number.isInteger(page) || page < 1)) {
    errors.page = 'Page must be a whole number of 1 or more';
  }
  if (query.limit !== undefined && (limit === null || !Number.isInteger(limit) || limit < 1)) {
    errors.limit = 'Limit must be a whole number of 1 or more';
  }
  if (query.minPrice !== undefined && (minPrice === null || minPrice < 0)) {
    errors.minPrice = 'minPrice must be 0 or more';
  }
  if (query.maxPrice !== undefined && (maxPrice === null || maxPrice < 0)) {
    errors.maxPrice = 'maxPrice must be 0 or more';
  }
  if (query.minArea !== undefined && (minArea === null || minArea < 0)) {
    errors.minArea = 'minArea must be 0 or more';
  }
  if (query.maxArea !== undefined && (maxArea === null || maxArea < 0)) {
    errors.maxArea = 'maxArea must be 0 or more';
  }
  if (query.bedrooms !== undefined && (bedrooms === null || !Number.isInteger(bedrooms) || bedrooms < 0)) {
    errors.bedrooms = 'bedrooms must be 0 or more';
  }

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    errors.minPrice = 'minPrice cannot be greater than maxPrice';
  }
  if (minArea !== null && maxArea !== null && minArea > maxArea) {
    errors.minArea = 'minArea cannot be greater than maxArea';
  }

  let status;
  if (query.status !== undefined && query.status !== '') {
    status = String(query.status).trim().toLowerCase();
    if (!PROPERTY_STATUSES.includes(status)) {
      errors.status = `Status must be one of: ${PROPERTY_STATUSES.join(', ')}`;
    }
  }

  let propertyType;
  if (query.propertyType !== undefined && query.propertyType !== '') {
    propertyType = String(query.propertyType).trim().toLowerCase();
    if (!PROPERTY_TYPES.includes(propertyType)) {
      errors.propertyType = `Property type must be one of: ${PROPERTY_TYPES.join(', ')}`;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiError(400, 'Some filters are not valid.', 'INVALID_PROPERTY_FILTER', errors);
  }

  return {
    page: page ?? 1,
    limit: Math.min(limit ?? 12, 50),
    minPrice,
    maxPrice,
    minArea,
    maxArea,
    bedrooms,
    status,
    propertyType,
    search: typeof query.search === 'string' ? query.search.trim() : '',
    locality: typeof query.locality === 'string' ? query.locality.trim() : '',
    city: typeof query.city === 'string' ? query.city.trim() : '',
  };
};
