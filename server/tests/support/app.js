import { MongoMemoryServer } from 'mongodb-memory-server';

const DEFAULT_TEST_SECRET = 'propiq-test-secret-0123456789abcdef';

export const mongoServer = await MongoMemoryServer.create();

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = mongoServer.getUri('propiq-test');
process.env.JWT_SECRET = DEFAULT_TEST_SECRET;
process.env.JWT_EXPIRES_IN = '1h';
process.env.PORT = '0';
process.env.CLIENT_URL = 'http://localhost:5173';

export const { default: app } = await import('../../app.js');
export const { User } = await import('../../models/User.js');
export const { Property } = await import('../../models/Property.js');
export const { HistoricalPrice } = await import('../../models/HistoricalPrice.js');
export const { connectDatabase, disconnectDatabase, getDatabaseStatus, isDatabaseReady } = await import(
  '../../config/db.js'
);
export const { requireAuth } = await import('../../middleware/requireAuth.js');
export const { requireRole } = await import('../../middleware/requireRole.js');
export const { errorHandler } = await import('../../middleware/errorHandler.js');
export const { signToken } = await import('../../utils/jwt.js');

export const TEST_JWT_SECRET = DEFAULT_TEST_SECRET;
export const TEST_DATABASE_NAME = 'propiq-test';
