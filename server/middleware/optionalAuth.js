import { isDatabaseReady } from '../config/db.js';
import { User } from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';

/**
 * Attaches the signed-in user when a valid session is present, and stays silent
 * when it is not.
 *
 * PropVal answers public listing questions without a session, so requiring a
 * token would break existing behaviour. Analytics questions are the exception:
 * they need to know who is asking, so `requireRole('admin')` decides what a
 * given user is allowed to see once this middleware has attached the role.
 */
export const optionalAuth = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');

  if (!token || scheme?.toLowerCase() !== 'bearer' || !isDatabaseReady()) {
    return next();
  }

  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.id);
    if (user) {
      req.user = user;
    }
  } catch {
    // A stale or malformed token simply means "not signed in" here. The
    // authenticated endpoints still reject it through `requireAuth`.
  }

  return next();
};
