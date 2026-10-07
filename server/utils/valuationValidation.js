import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';
import { PROPERTY_TYPES } from '../models/Property.js';
import { VALUATION_LIMITS } from '../config/valuationConfig.js';

const MAX_AMENITIES = 20;
const MAX_AMENITY_LENGTH = 60;
const MAX_AGE = 200;
const MAX_ROOMS = 50;
const MAX_CITY_LENGTH = 80;
const MAX_LOCALITY_LENGTH = 120;

const invalidBody = () => new ApiError(400, 'Request body must be a JSON object.', 'INVALID_BODY');

const validationFailed = (details) =>
  new ApiError(400, 'Please correct the highlighted valuation fields.', 'VALUATION_VALIDATION_FAILED', details);

const readText = (value) => (typeof value === 'string' ? value.trim() : '');

const parseNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const validateText = (errors, field, value, { label, maxLength }) => {
  if (typeof value !== 'string' || value.trim() === '') {
    errors[field] = `${label} is required`;
    return undefined;
  }
  const text = value.trim();
  if (text.length > maxLength) {
    errors[field] = `${label} must be ${maxLength} characters or fewer`;
    return undefined;
  }
  return text;
};

const validateArea = (errors, value) => {
  if (value === undefined || value === null || value === '') {
    errors.builtUpArea = 'Built-up area is required';
    return undefined;
  }

  const parsed = parseNumber(value);
  if (parsed === null) {
    errors.builtUpArea = 'Built-up area must be a number';
    return undefined;
  }
  if (parsed <= 0) {
    errors.builtUpArea = 'Built-up area must be greater than 0';
    return undefined;
  }
  if (parsed > VALUATION_LIMITS.maxArea) {
    errors.builtUpArea = 'Built-up area looks unrealistic';
    return undefined;
  }
  return parsed;
};

const validateAge = (errors, value) => {
  if (value === undefined || value === null || value === '') return 0;

  const parsed = parseNumber(value);
  if (parsed === null) {
    errors.propertyAge = 'Property age must be a number';
    return 0;
  }
  if (!Number.isInteger(parsed)) {
    errors.propertyAge = 'Property age must be a whole number';
    return 0;
  }
  if (parsed < 0) {
    errors.propertyAge = 'Property age must be 0 or more';
    return 0;
  }
  if (parsed > MAX_AGE) {
    errors.propertyAge = 'Property age looks unrealistic';
    return 0;
  }
  return parsed;
};

const validateRoomCount = (errors, field, value, label) => {
  if (value === undefined || value === null || value === '') return undefined;

  const parsed = parseNumber(value);
  if (parsed === null) {
    errors[field] = `${label} must be a number`;
    return undefined;
  }
  if (!Number.isInteger(parsed)) {
    errors[field] = `${label} must be a whole number`;
    return undefined;
  }
  if (parsed < 0) {
    errors[field] = `${label} must be 0 or more`;
    return undefined;
  }
  if (parsed > MAX_ROOMS) {
    errors[field] = `${label} looks unrealistic`;
    return undefined;
  }
  return parsed;
};

const validateAmenities = (errors, value) => {
  if (value === undefined || value === null) return [];

  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : null;
  if (!raw) {
    errors.amenities = 'Amenities must be a list of short labels';
    return [];
  }

  const amenities = raw.map((item) => readText(item)).filter(Boolean);
  if (amenities.length > MAX_AMENITIES) {
    errors.amenities = `Use at most ${MAX_AMENITIES} amenities`;
    return [];
  }
  if (amenities.some((amenity) => amenity.length > MAX_AMENITY_LENGTH)) {
    errors.amenities = `Each amenity must be ${MAX_AMENITY_LENGTH} characters or fewer`;
    return [];
  }
  return amenities;
};

/**
 * Validates a valuation request.
 *
 * A request supplies either a `propertyId` (the stored property is then valued)
 * or inline property characteristics. When both are present the stored property
 * wins, because a saved listing already holds the authoritative details.
 */
export const validateValuationInput = (body) => {
  if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidBody();
  }

  const errors = {};
  const input = {};

  if (body.propertyId !== undefined && body.propertyId !== null && body.propertyId !== '') {
    if (!mongoose.isValidObjectId(body.propertyId)) {
      throw validationFailed({ propertyId: 'Property id is invalid' });
    }
    input.propertyId = String(body.propertyId);
  }

  if (input.propertyId === undefined) {
    const hasCharacteristics = ['locality', 'city', 'propertyType', 'builtUpArea'].some(
      (field) => body[field] !== undefined,
    );
    if (!hasCharacteristics) {
      throw new ApiError(
        400,
        'Provide a propertyId or the property characteristics to value.',
        'VALUATION_INPUT_REQUIRED',
      );
    }

    input.locality = validateText(errors, 'locality', body.locality, {
      label: 'Locality',
      maxLength: MAX_LOCALITY_LENGTH,
    });
    input.city = validateText(errors, 'city', body.city, {
      label: 'City',
      maxLength: MAX_CITY_LENGTH,
    });

    if (body.propertyType === undefined || body.propertyType === null || body.propertyType === '') {
      errors.propertyType = 'Property type is required';
    } else {
      const propertyType = readText(body.propertyType).toLowerCase();
      if (!PROPERTY_TYPES.includes(propertyType)) {
        errors.propertyType = `Property type must be one of: ${PROPERTY_TYPES.join(', ')}`;
      } else {
        input.propertyType = propertyType;
      }
    }

    input.builtUpArea = validateArea(errors, body.builtUpArea);
    input.propertyAge = validateAge(errors, body.propertyAge);

    if (body.bedrooms !== undefined) {
      input.bedrooms = validateRoomCount(errors, 'bedrooms', body.bedrooms, 'Bedrooms');
    }
    if (body.bathrooms !== undefined) {
      input.bathrooms = validateRoomCount(errors, 'bathrooms', body.bathrooms, 'Bathrooms');
    }
    if (body.amenities !== undefined) {
      input.amenities = validateAmenities(errors, body.amenities);
    }
  }

  if (Object.keys(errors).length > 0) {
    throw validationFailed(errors);
  }

  return input;
};
