import { Router } from 'express';
import { createValuation } from '../controllers/valuationController.js';

export const valuationRouter = Router();

valuationRouter.post('/', createValuation);
