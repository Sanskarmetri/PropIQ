import {
  getAnalyticsFilterOptions,
  getAnalyticsOverview as readAnalyticsOverview,
  getAnalyticsReport as readAnalyticsReport,
  parseAnalyticsFilters,
} from '../services/analyticsService.js';
import { sendSuccess } from '../utils/response.js';

/**
 * Admin analytics endpoints.
 *
 * The controller only validates the query string and forwards it: every figure
 * comes from the analytics service, so the REST responses, the report and the
 * PropVal answers are all the same computation.
 */
export const getAnalyticsOverview = async (req, res, next) => {
  try {
    const filters = parseAnalyticsFilters(req.query);
    const data = await readAnalyticsOverview(filters);

    return sendSuccess(res, { data });
  } catch (error) {
    return next(error);
  }
};

export const getAnalyticsReport = async (req, res, next) => {
  try {
    const filters = parseAnalyticsFilters(req.query);
    const data = await readAnalyticsReport(filters);

    return sendSuccess(res, { data });
  } catch (error) {
    return next(error);
  }
};

export const getAnalyticsFilters = async (req, res, next) => {
  try {
    const data = await getAnalyticsFilterOptions();

    return sendSuccess(res, { data });
  } catch (error) {
    return next(error);
  }
};
