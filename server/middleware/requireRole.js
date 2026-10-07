import { ApiError } from '../utils/ApiError.js';

export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication is required to access this resource.', 'AUTH_REQUIRED'));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(
      new ApiError(403, `This action requires one of these roles: ${allowedRoles.join(', ')}.`, 'INSUFFICIENT_ROLE'),
    );
  }

  return next();
};
