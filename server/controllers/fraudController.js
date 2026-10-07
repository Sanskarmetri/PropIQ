import { screenStoredProperty } from '../services/fraudService.js';
import { sendSuccess } from '../utils/response.js';

/**
 * POST /api/fraud/check
 *
 * The controller stays thin: it forwards the validated request to the screening
 * service and wraps the result in the standard response envelope. All screening
 * logic lives in `fraudService` and `duplicateDetectionService` so PropVal can
 * call the same service directly later.
 */
export const checkProperty = async (req, res, next) => {
  try {
    const assessment = await screenStoredProperty(req.body?.propertyId);

    return sendSuccess(res, {
      message:
        assessment.status === 'unavailable'
          ? 'Screening completed with the available checks. Pricing screening was unavailable for this listing.'
          : 'Listing screening completed.',
      data: {
        screening: {
          property: {
            id: assessment.property?.id ?? null,
            title: assessment.property?.title ?? null,
            locality: assessment.property?.locality ?? null,
            city: assessment.property?.city ?? null,
            propertyType: assessment.property?.propertyType ?? null,
            askingPrice: assessment.property?.askingPrice ?? null,
          },
          status: assessment.status,
          riskLevel: assessment.riskLevel,
          flags: assessment.flags,
          summary: assessment.summary,
          partial: assessment.partial,
          valuation: assessment.valuation,
          valuationUnavailable: assessment.valuationUnavailable,
          model: assessment.model,
          disclaimer: assessment.disclaimer,
          limitations: assessment.limitations,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};
