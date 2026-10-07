import { handlePropValMessage } from '../services/propval/propvalService.js';
import { validatePropValInput } from '../utils/propvalValidation.js';
import { sendSuccess } from '../utils/response.js';

/**
 * Accepts one PropVal message plus the small amount of page context the client
 * already knows, and returns the structured answer.
 *
 * The controller only validates and forwards: parsing lives in the propval
 * service and every market, listing, screening and analytics lookup happens in
 * the existing PropIQ services. `req.user` is present when the request carried a
 * valid session, which is what lets the admin-only questions be authorised.
 */
export const askPropVal = async (req, res, next) => {
  try {
    const { message, context } = validatePropValInput(req.body);
    const data = await handlePropValMessage({ message, context, user: req.user ?? null });

    return sendSuccess(res, { data });
  } catch (error) {
    return next(error);
  }
};
