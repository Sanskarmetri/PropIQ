import { Router } from 'express';
import {
  createProperty,
  deleteProperty,
  getMyProperties,
  getProperties,
  getPropertyById,
  updateProperty,
} from '../controllers/propertyController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

export const propertyRouter = Router();

propertyRouter.get('/', getProperties);
propertyRouter.get('/mine', requireAuth, requireRole('seller', 'admin'), getMyProperties);
propertyRouter.get('/:id', getPropertyById);
propertyRouter.post('/', requireAuth, requireRole('seller', 'admin'), createProperty);
propertyRouter.put('/:id', requireAuth, requireRole('seller', 'admin'), updateProperty);
propertyRouter.delete('/:id', requireAuth, requireRole('seller', 'admin'), deleteProperty);
