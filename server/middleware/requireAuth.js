import { isDatabaseReady } from '../config/db.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyToken } from '../utils/jwt.js';

const databaseUnavailable = () =>
  new ApiError(503, 'Authentication is unavailable while MongoDB is disconnected.', 'DATABASE_UNAVAILABLE');

export const requireAuth = async (req, res, next) => {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');

    if (!token || scheme?.toLowerCase() !== 'bearer') {
      throw new ApiError(401, 'Authentication is required to access this resource.', 'AUTH_REQUIRED');
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new ApiError(401, 'Your session is invalid or has expired. Please sign in again.', 'INVALID_TOKEN');
    }

    if (!isDatabaseReady()) {
      throw databaseUnavailable();
    }

    const user = await User.findById(payload.id);
    if (!user) {
      throw new ApiError(401, 'The account linked to this session no longer exists.', 'INVALID_TOKEN');
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};
