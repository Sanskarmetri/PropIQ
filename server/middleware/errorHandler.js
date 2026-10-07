import { ApiError } from '../utils/ApiError.js';
import { sendError } from '../utils/response.js';

const logSafely = (error) => {
  console.error(`[propiq] ${error.name || 'Error'}: ${error.message}`);
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof ApiError) {
    return sendError(res, {
      httpStatus: error.status,
      message: error.message,
      code: error.code,
      details: error.details,
    });
  }

  if (error.type === 'entity.parse.failed') {
    return sendError(res, {
      message: 'The request body is not valid JSON.',
      code: 'INVALID_JSON',
    });
  }

  if (error.type === 'entity.too.large') {
    return sendError(res, {
      httpStatus: 413,
      message: 'The request body is too large.',
      code: 'PAYLOAD_TOO_LARGE',
    });
  }

  if (error.name === 'ValidationError') {
    return sendError(res, {
      httpStatus: 400,
      message: 'The request contains invalid data.',
      code: 'VALIDATION_ERROR',
      details: Object.values(error.errors).map((item) => item.message),
    });
  }

  if (error.code === 11000) {
    const isUserConflict = Object.prototype.hasOwnProperty.call(error.keyValue || {}, 'email');
    return sendError(res, {
      httpStatus: 409,
      message: isUserConflict
        ? 'An account with that email address already exists.'
        : 'A property with those details already exists.',
      code: isUserConflict ? 'EMAIL_TAKEN' : 'DUPLICATE_PROPERTY',
    });
  }

  if (error.name === 'CastError') {
    return sendError(res, {
      message: 'One of the supplied values has the wrong format.',
      code: 'INVALID_VALUE',
    });
  }

  logSafely(error);
  return sendError(res, {
    httpStatus: 500,
    message: 'An unexpected server error occurred.',
    code: 'INTERNAL_ERROR',
  });
};
