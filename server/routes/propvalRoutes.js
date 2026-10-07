import { Router } from 'express';
import { askPropVal } from '../controllers/propvalController.js';
import { optionalAuth } from '../middleware/optionalAuth.js';

export const propvalRouter = Router();

/**
 * PropVal reads the same public listing, valuation and screening data as the
 * other discovery endpoints, so it stays usable without a session.
 *
 * A session is still attached when one is sent, because the admin-only
 * analytics questions need to know who is asking before they run any query.
 */
propvalRouter.post('/', optionalAuth, askPropVal);
