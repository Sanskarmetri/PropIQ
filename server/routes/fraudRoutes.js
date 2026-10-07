import { Router } from 'express';
import { checkProperty } from '../controllers/fraudController.js';

export const fraudRouter = Router();

/**
 * Screening reads only data that is already public on the listing endpoints, so
 * it is available to every PropIQ visitor. There is no role restriction, because
 * buyers and sellers benefit from the same screening result.
 */
fraudRouter.post('/check', checkProperty);
