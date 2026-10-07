import { Router } from 'express';
import {
  getAnalyticsFilters,
  getAnalyticsOverview,
  getAnalyticsReport,
} from '../controllers/analyticsController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

export const analyticsRouter = Router();

/**
 * Analytics expose volume, pricing and screening aggregates across every
 * listing in the database, so they are limited to authenticated admins. The same
 * authorization is applied to the filter options, since they describe the whole
 * collection rather than a single user's listings.
 */
analyticsRouter.use(requireAuth, requireRole('admin'));

analyticsRouter.get('/overview', getAnalyticsOverview);
analyticsRouter.get('/report', getAnalyticsReport);
analyticsRouter.get('/filters', getAnalyticsFilters);
