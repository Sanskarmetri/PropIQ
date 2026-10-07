import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import { spawnSync } from 'node:child_process';
import mongoose from 'mongoose';
import request from 'supertest';
import {
  app,
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus,
  mongoServer,
  Property,
  User,
} from './support/app.js';

const envModuleUrl = new URL('../config/env.js', import.meta.url).href;

const loadEnvConfig = (overrides) => {
  const baseEnv = {
    PATH: process.env.PATH,
    NODE_ENV: 'test',
    PORT: '0',
    CLIENT_URL: 'http://localhost:5173',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/propiq',
    JWT_SECRET: 'propiq-env-check-secret-0123456789',
  };

  const childEnv = { ...baseEnv };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete childEnv[key];
    } else {
      childEnv[key] = value;
    }
  }

  return spawnSync(
    process.execPath,
    [
      '-e',
      `import(${JSON.stringify(envModuleUrl)}).then(() => console.log('env-config-loaded')).catch((error) => { console.error(error.message); process.exitCode = 1; });`,
    ],
    { env: childEnv, encoding: 'utf8' },
  );
};

const propertyFixture = (overrides = {}) => ({
  title: '3BHK Apartment in Indiranagar',
  description: 'Bright corner apartment.',
  locality: 'Indiranagar',
  city: 'Bengaluru',
  propertyType: 'apartment',
  builtUpArea: 1680,
  bedrooms: 3,
  bathrooms: 2,
  propertyAge: 6,
  amenities: ['Parking'],
  askingPrice: 12500000,
  status: 'active',
  images: [],
  owner: new mongoose.Types.ObjectId(),
  ...overrides,
});

before(async () => {
  const connected = await connectDatabase();
  assert.equal(connected, true, 'tests need a working MongoDB connection');
});

after(async () => {
  await connectDatabase();
  await disconnectDatabase();
  await mongoServer.stop();
});

beforeEach(async () => {
  if (!isReady()) {
    await connectDatabase();
  }
  await Promise.all([User.deleteMany({}), Property.deleteMany({})]);
});

function isReady() {
  return getDatabaseStatus() === 'connected';
}

test('GET /api/health reports the database connection state', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.database, 'connected');
  assert.equal(response.body.service, 'propiq-api');
  assert.ok(Date.parse(response.body.timestamp));
});

test('GET /api/health reports a degraded state when MongoDB is disconnected', async () => {
  await disconnectDatabase();
  assert.equal(getDatabaseStatus(), 'disconnected');

  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'degraded');
  assert.equal(health.body.database, 'disconnected');

  const properties = await request(app).get('/api/properties');
  assert.equal(properties.status, 503);
  assert.equal(properties.body.success, false);
  assert.equal(properties.body.code, 'DATABASE_UNAVAILABLE');

  const register = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Aarav Sharma', email: 'aarav@example.com', password: 'Str0ng-PropIQ-Password' });
  assert.equal(register.status, 503);
  assert.equal(register.body.code, 'DATABASE_UNAVAILABLE');

  await connectDatabase();
  assert.equal(getDatabaseStatus(), 'connected');
});

test('existing property routes still work with authentication in place', async () => {
  const property = await Property.create(propertyFixture());
  await Property.create(propertyFixture({ title: 'Villa in Whitefield', locality: 'Whitefield' }));

  const list = await request(app).get('/api/properties').query({ locality: 'Indiranagar' });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.properties.length, 1);
  assert.equal(list.body.data.pagination.total, 1);

  const byId = await request(app).get(`/api/properties/${property._id}`);
  assert.equal(byId.status, 200);
  assert.equal(byId.body.data.property.title, '3BHK Apartment in Indiranagar');

  const invalidId = await request(app).get('/api/properties/not-an-object-id');
  assert.equal(invalidId.status, 400);
  assert.equal(invalidId.body.code, 'INVALID_PROPERTY_ID');

  const missingId = await request(app).get('/api/properties/507f1f77bcf86cd799439011');
  assert.equal(missingId.status, 404);
  assert.equal(missingId.body.code, 'PROPERTY_NOT_FOUND');
});

test('unknown routes keep the standard error envelope', async () => {
  const response = await request(app).get('/api/does-not-exist');

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /Route not found/);
});

test('missing JWT_SECRET and MONGODB_URI fail startup with an actionable message', () => {
  const result = loadEnvConfig({ MONGODB_URI: '', JWT_SECRET: '' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing required environment variables: MONGODB_URI, JWT_SECRET/);
  assert.match(result.stderr, /server\/\.env\.example/);
});

test('a short JWT_SECRET fails startup instead of falling back to a default', () => {
  const result = loadEnvConfig({ JWT_SECRET: 'short' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /JWT_SECRET must be at least 16 characters/);
});

test('a malformed MONGODB_URI fails startup', () => {
  const result = loadEnvConfig({ MONGODB_URI: 'propiq-local' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /MONGODB_URI must start with "mongodb:\/\/"/);
});

test('a complete environment loads successfully', () => {
  const result = loadEnvConfig({});

  assert.equal(result.status, 0);
  assert.match(result.stdout, /env-config-loaded/);
});
