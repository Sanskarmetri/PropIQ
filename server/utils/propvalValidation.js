import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';

const MAX_MESSAGE_LENGTH = 500;
const MAX_ROUTE_LENGTH = 200;
const ALLOWED_CONTEXT_KEYS = ['currentRoute', 'currentPropertyId', 'lastSearch', 'lastSearchResultCount'];

const invalidBody = () => new ApiError(400, 'Request body must be a JSON object.', 'INVALID_BODY');

const validationFailed = (details) =>
  new ApiError(400, 'Please correct the PropVal request.', 'PROPVAL_VALIDATION_FAILED', details);

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validates a PropVal message.
 *
 * The message is only ever read as text: it is length bounded, stripped of
 * control characters, and later matched against fixed rules or escaped into a
 * regular expression. Nothing in this file evaluates input, and no request field
 * other than the allow-listed context keys is ever forwarded to a query.
 */
export const validatePropValInput = (body) => {
  if (!isPlainObject(body)) {
    throw invalidBody();
  }

  const errors = {};

  let message = '';
  if (typeof body.message !== 'string') {
    errors.message = 'Message must be text';
  } else {
    message = body.message.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (message.length === 0) {
      errors.message = 'Message cannot be empty';
    } else if (message.length > MAX_MESSAGE_LENGTH) {
      errors.message = `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`;
    }
  }

  const context = {};

  if (body.context !== undefined && body.context !== null) {
    if (!isPlainObject(body.context)) {
      errors.context = 'Context must be an object';
    } else {
      const source = body.context;

      for (const key of Object.keys(source)) {
        if (!ALLOWED_CONTEXT_KEYS.includes(key)) {
          errors[`context.${key}`] = 'Context field is not supported';
        }
      }

      if (source.currentRoute !== undefined && source.currentRoute !== null) {
        if (typeof source.currentRoute !== 'string') {
          errors['context.currentRoute'] = 'Current route must be text';
        } else if (source.currentRoute.length > MAX_ROUTE_LENGTH) {
          errors['context.currentRoute'] = `Current route must be ${MAX_ROUTE_LENGTH} characters or fewer`;
        } else {
          context.currentRoute = source.currentRoute;
        }
      }

      if (source.currentPropertyId !== undefined && source.currentPropertyId !== null) {
        if (typeof source.currentPropertyId !== 'string' || !mongoose.isValidObjectId(source.currentPropertyId)) {
          errors['context.currentPropertyId'] = 'Current property id is invalid';
        } else {
          context.currentPropertyId = source.currentPropertyId;
        }
      }

      if (source.lastSearch !== undefined && source.lastSearch !== null) {
        if (!isPlainObject(source.lastSearch)) {
          errors['context.lastSearch'] = 'Last search must be an object';
        } else {
          context.lastSearch = source.lastSearch;
        }
      }

      if (source.lastSearchResultCount !== undefined && source.lastSearchResultCount !== null) {
        const count = source.lastSearchResultCount;
        if (!Number.isInteger(count) || count < 0) {
          errors['context.lastSearchResultCount'] = 'Last search result count must be 0 or more';
        } else {
          context.lastSearchResultCount = count;
        }
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    throw validationFailed(errors);
  }

  return { message, context };
};
