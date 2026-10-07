import { valueProperty, valueStoredProperty } from '../services/valuationService.js';
import { validateValuationInput } from '../utils/valuationValidation.js';
import { sendSuccess } from '../utils/response.js';

/**
 * Values a property from inline characteristics or from a stored `propertyId`.
 * All market lookups and arithmetic live in the valuation service.
 */
export const createValuation = async (req, res, next) => {
  try {
    const input = validateValuationInput(req.body);
    const result = input.propertyId
      ? await valueStoredProperty(input.propertyId)
      : await valueProperty(input, { source: 'inline' });

    return sendSuccess(res, {
      message: 'Valuation calculated from development sample market data.',
      data: { valuation: result },
    });
  } catch (error) {
    return next(error);
  }
};
