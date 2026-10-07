import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import {
  app,
  connectDatabase,
  disconnectDatabase,
  errorHandler,
  mongoServer,
  requireAuth,
  requireRole,
  User,
} from './support/app.js';

const validUser = (overrides = {}) => ({
  name: 'Aarav Sharma',
  email: 'aarav@example.com',
  password: 'Str0ng-PropIQ-Password',
  ...overrides,
});

const registerUser = async (overrides = {}) => {
  const response = await request(app).post('/api/auth/register').send(validUser(overrides));
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response;
};

const buildRoleTestApp = () => {
  const roleApp = express();
  roleApp.get('/admin-area', requireAuth, requireRole('admin'), (req, res) => {
    res.json({ success: true, data: { email: req.user.email } });
  });
  roleApp.use(errorHandler);
  return roleApp;
};

before(async () => {
  const connected = await connectDatabase();
  assert.equal(connected, true, 'tests need a working MongoDB connection');
});

after(async () => {
  await disconnectDatabase();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

test('register creates a buyer account and returns a token without the password', async () => {
  const response = await registerUser({ email: '  Aarav@Example.com  ' });

  assert.equal(response.body.success, true);
  assert.equal(response.body.message, 'Account created successfully.');
  assert.equal(response.body.data.user.email, 'aarav@example.com');
  assert.equal(response.body.data.user.role, 'buyer');
  assert.equal(response.body.data.user.password, undefined);
  assert.ok(response.body.data.user.id);

  const payload = jwt.verify(response.body.data.token, 'propiq-test-secret-0123456789abcdef', {
    issuer: 'propiq-api',
  });
  assert.equal(payload.id, response.body.data.user.id);
  assert.equal(payload.role, 'buyer');
});

test('register hashes the stored password with bcrypt', async () => {
  await registerUser();

  const storedUser = await User.findOne({ email: 'aarav@example.com' }).select('+password');
  assert.notEqual(storedUser.password, 'Str0ng-PropIQ-Password');
  assert.match(storedUser.password, /^\$2[aby]\$\d{2}\$/);
  assert.equal(await storedUser.comparePassword('Str0ng-PropIQ-Password'), true);
  assert.equal(await storedUser.comparePassword('not-the-password'), false);
});

test('register rejects a duplicate email address case-insensitively', async () => {
  await registerUser();
  const response = await request(app)
    .post('/api/auth/register')
    .send(validUser({ email: 'AARAV@example.com' }));

  assert.equal(response.status, 409);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, 'EMAIL_TAKEN');
});

test('register rejects weak passwords and missing fields', async () => {
  const shortPassword = await request(app)
    .post('/api/auth/register')
    .send(validUser({ password: 'Sh0rt!' }));
  assert.equal(shortPassword.status, 400);
  assert.equal(shortPassword.body.code, 'PASSWORD_TOO_SHORT');

  const longPassword = await request(app)
    .post('/api/auth/register')
    .send(validUser({ password: 'a'.repeat(73) }));
  assert.equal(longPassword.status, 400);
  assert.equal(longPassword.body.code, 'PASSWORD_TOO_LONG');

  const missingName = await request(app).post('/api/auth/register').send({ email: 'a@b.co', password: 'Passw0rd!' });
  assert.equal(missingName.status, 400);
  assert.equal(missingName.body.code, 'INVALID_NAME');

  const badEmail = await request(app)
    .post('/api/auth/register')
    .send(validUser({ email: 'not-an-email' }));
  assert.equal(badEmail.status, 400);
  assert.equal(badEmail.body.code, 'INVALID_EMAIL');

  const missingEmail = await request(app).post('/api/auth/register').send({ name: 'Aarav', password: 'Passw0rd!' });
  assert.equal(missingEmail.status, 400);
  assert.equal(missingEmail.body.code, 'EMAIL_REQUIRED');
});

test('register never lets a client self-assign the admin role', async () => {
  const adminAttempt = await registerUser({ role: 'admin' });
  assert.equal(adminAttempt.body.data.user.role, 'buyer');

  const sellerAttempt = await request(app)
    .post('/api/auth/register')
    .send(validUser({ email: 'diya@example.com', role: 'seller' }));
  assert.equal(sellerAttempt.body.data.user.role, 'seller');
});

test('login succeeds with correct credentials and rejects invalid ones', async () => {
  await registerUser();

  const success = await request(app)
    .post('/api/auth/login')
    .send({ email: 'aarav@example.com', password: 'Str0ng-PropIQ-Password' });
  assert.equal(success.status, 200);
  assert.equal(success.body.success, true);
  assert.equal(success.body.data.user.email, 'aarav@example.com');
  assert.equal(success.body.data.user.password, undefined);
  assert.ok(success.body.data.token);

  const wrongPassword = await request(app)
    .post('/api/auth/login')
    .send({ email: 'aarav@example.com', password: 'wrong-password' });
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongPassword.body.code, 'INVALID_CREDENTIALS');

  const unknownUser = await request(app)
    .post('/api/auth/login')
    .send({ email: 'nobody@example.com', password: 'Str0ng-PropIQ-Password' });
  assert.equal(unknownUser.status, 401);
  assert.equal(unknownUser.body.code, 'INVALID_CREDENTIALS');
  assert.equal(unknownUser.body.message, wrongPassword.body.message);
});

test('GET /api/auth/me requires a valid bearer token', async () => {
  const { body } = await registerUser();
  const token = body.data.token;

  const noHeader = await request(app).get('/api/auth/me');
  assert.equal(noHeader.status, 401);
  assert.equal(noHeader.body.code, 'AUTH_REQUIRED');

  const wrongScheme = await request(app).get('/api/auth/me').set('Authorization', `Basic ${token}`);
  assert.equal(wrongScheme.status, 401);
  assert.equal(wrongScheme.body.code, 'AUTH_REQUIRED');

  const garbageToken = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt');
  assert.equal(garbageToken.status, 401);
  assert.equal(garbageToken.body.code, 'INVALID_TOKEN');

  const foreignSecret = jwt.sign({ id: '507f1f77bcf86cd799439011', role: 'admin' }, 'some-other-secret');
  const foreignToken = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${foreignSecret}`);
  assert.equal(foreignToken.status, 401);
  assert.equal(foreignToken.body.code, 'INVALID_TOKEN');

  const allowed = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.success, true);
  assert.equal(allowed.body.data.user.id, body.data.user.id);
  assert.equal(allowed.body.data.user.password, undefined);
});

test('a token for a deleted account is rejected', async () => {
  const { body } = await registerUser();
  await User.deleteMany({});

  const response = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${body.data.token}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'INVALID_TOKEN');
});

test('requireRole blocks buyers and admins from role-restricted routes', async () => {
  const roleApp = buildRoleTestApp();
  const buyer = await registerUser({ email: 'buyer@example.com' });
  const admin = await registerUser({ email: 'admin@example.com', role: 'admin' });

  const buyerResponse = await request(roleApp)
    .get('/admin-area')
    .set('Authorization', `Bearer ${buyer.body.data.token}`);
  assert.equal(buyerResponse.status, 403);
  assert.equal(buyerResponse.body.success, false);
  assert.equal(buyerResponse.body.code, 'INSUFFICIENT_ROLE');

  const anonymousResponse = await request(roleApp).get('/admin-area');
  assert.equal(anonymousResponse.status, 401);

  const adminUser = await User.findOne({ email: 'admin@example.com' });
  assert.equal(adminUser.role, 'buyer', 'public registration must not persist an admin role');

  const promoted = await User.findOneAndUpdate({ email: 'admin@example.com' }, { role: 'admin' }, { new: true });
  assert.equal(promoted.role, 'admin');

  const adminResponse = await request(roleApp)
    .get('/admin-area')
    .set('Authorization', `Bearer ${admin.body.data.token}`);
  assert.equal(adminResponse.status, 200);
  assert.equal(adminResponse.body.data.email, 'admin@example.com');
});
