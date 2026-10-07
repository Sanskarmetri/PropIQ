import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import {
  app,
  connectDatabase,
  disconnectDatabase,
  mongoServer,
  Property,
  User,
} from './support/app.js';

const accounts = {
  buyer: { name: 'Aarav Sharma', email: 'buyer@example.com', password: 'Str0ng-PropIQ-Password', role: 'buyer' },
  seller: { name: 'Diya Menon', email: 'seller@example.com', password: 'Str0ng-PropIQ-Password', role: 'seller' },
  otherSeller: { name: 'Kabir Rao', email: 'other-seller@example.com', password: 'Str0ng-PropIQ-Password', role: 'seller' },
  admin: { name: 'PropIQ Admin', email: 'admin@example.com', password: 'Str0ng-PropIQ-Password', role: 'admin' },
};

const sessions = {};

const signIn = async (account) => {
  if (sessions[account.email]) return sessions[account.email];

  const registration = await request(app).post('/api/auth/register').send(account);
  assert.equal(registration.status, 201, JSON.stringify(registration.body));

  if (account.role !== 'buyer') {
    await User.updateOne({ email: account.email }, { $set: { role: account.role } });
  }

  const user = await User.findOne({ email: account.email });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: account.email, password: account.password });
  assert.equal(login.status, 200);

  sessions[account.email] = { token: login.body.data.token, id: user._id.toString() };
  return sessions[account.email];
};

const asSeller = (extra = {}) => signIn(accounts.seller).then((session) => ({ ...session, ...extra }));
const asOtherSeller = () => signIn(accounts.otherSeller);
const asAdmin = () => signIn(accounts.admin);
const asBuyer = () => signIn(accounts.buyer);

const authed = (method, token) => ({ method, headers: { Authorization: `Bearer ${token}` } });

const propertyPayload = (overrides = {}) => ({
  title: 'Sunlit Courtyard Residence',
  description: 'A calm, light-filled apartment near the park.',
  locality: 'Indiranagar',
  city: 'Bengaluru',
  propertyType: 'apartment',
  builtUpArea: 1840,
  bedrooms: 3,
  bathrooms: 3,
  propertyAge: 4,
  amenities: ['Private balcony', 'Covered parking'],
  askingPrice: 24500000,
  ...overrides,
});

const createProperty = async (token, overrides = {}) => {
  const response = await request(app)
    .post('/api/properties')
    .set('Authorization', `Bearer ${token}`)
    .send(propertyPayload(overrides));

  return response;
};

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
  for (const key of Object.keys(sessions)) {
    delete sessions[key];
  }
  await Promise.all([User.deleteMany({}), Property.deleteMany({})]);
});

test('GET /api/properties is public and returns properties with pagination metadata', async () => {
  const owner = await User.create(accounts.seller);
  await Property.create([
    propertyPayload({ title: 'Alpha Home', owner: owner._id }),
    propertyPayload({ title: 'Beta Home', owner: owner._id }),
  ]);

  const response = await request(app).get('/api/properties');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.properties.length, 2);
  assert.deepEqual(response.body.data.pagination, { page: 1, limit: 12, total: 2, pages: 1 });
  assert.equal(response.body.properties, undefined);
});

test('GET /api/properties/:id returns a single public property', async () => {
  const owner = await User.create(accounts.seller);
  const property = await Property.create(propertyPayload({ owner: owner._id }));

  const response = await request(app).get(`/api/properties/${property._id}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.property.title, 'Sunlit Courtyard Residence');
  assert.equal(response.body.data.property.askingPrice, 24500000);
  assert.equal(response.body.data.property.builtUpArea, 1840);
  assert.equal(response.body.data.property.owner, owner._id.toString());
});

test('POST /api/properties requires authentication', async () => {
  const response = await request(app).post('/api/properties').send(propertyPayload());

  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'AUTH_REQUIRED');
});

test('a buyer cannot create a property', async () => {
  const buyer = await asBuyer();

  const response = await createProperty(buyer.token);

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, 'INSUFFICIENT_ROLE');
  assert.equal(await Property.countDocuments({}), 0);
});

test('a seller can create a property and owns it implicitly', async () => {
  const seller = await asSeller();

  const response = await createProperty(seller.token);

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.property.title, 'Sunlit Courtyard Residence');
  assert.equal(response.body.data.property.status, 'active');
  assert.equal(response.body.data.property.owner, seller.id);

  const stored = await Property.findById(response.body.data.property.id);
  assert.equal(stored.owner.toString(), seller.id);
  assert.ok(stored.createdAt);
  assert.ok(stored.updatedAt);
});

test('a spoofed owner in the request body is ignored', async () => {
  const seller = await asSeller();
  const otherSeller = await asOtherSeller();

  const response = await createProperty(seller.token, { owner: otherSeller.id });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.property.owner, seller.id);
});

test('property creation rejects invalid input', async () => {
  const seller = await asSeller();

  const missingTitle = await createProperty(seller.token, { title: undefined });
  assert.equal(missingTitle.status, 400);
  assert.equal(missingTitle.body.code, 'PROPERTY_VALIDATION_FAILED');
  assert.match(missingTitle.body.details.title, /required/i);

  const shortTitle = await createProperty(seller.token, { title: 'ab' });
  assert.equal(shortTitle.status, 400);
  assert.match(shortTitle.body.details.title, /at least 3/i);

  const badPrice = await createProperty(seller.token, { askingPrice: -5 });
  assert.equal(badPrice.status, 400);
  assert.match(badPrice.body.details.askingPrice, /greater than 0/i);

  const nonNumericPrice = await createProperty(seller.token, { askingPrice: 'free' });
  assert.equal(nonNumericPrice.status, 400);
  assert.match(nonNumericPrice.body.details.askingPrice, /must be a number/i);

  const badArea = await createProperty(seller.token, { builtUpArea: 0 });
  assert.equal(badArea.status, 400);
  assert.match(badArea.body.details.builtUpArea, /greater than 0/i);

  const badType = await createProperty(seller.token, { propertyType: 'castle' });
  assert.equal(badType.status, 400);
  assert.match(badType.body.details.propertyType, /apartment/);

  const badStatus = await createProperty(seller.token, { status: 'pending' });
  assert.equal(badStatus.status, 400);
  assert.match(badStatus.body.details.status, /active/);

  const negativeBedrooms = await createProperty(seller.token, { bedrooms: -1 });
  assert.equal(negativeBedrooms.status, 400);
  assert.match(negativeBedrooms.body.details.bedrooms, /0 or more/i);

  const longDescription = await createProperty(seller.token, { description: 'x'.repeat(2001) });
  assert.equal(longDescription.status, 400);
  assert.match(longDescription.body.details.description, /2000 characters or fewer/i);

  assert.equal(await Property.countDocuments({}), 0, 'no invalid property should be persisted');
});

test('amenities accept a comma separated string or an array', async () => {
  const seller = await asSeller();

  const fromString = await createProperty(seller.token, { amenities: 'Lift, Gym, , Pool' });
  assert.equal(fromString.status, 201);
  assert.deepEqual(fromString.body.data.property.amenities, ['Lift', 'Gym', 'Pool']);

  const fromArray = await createProperty(seller.token, { title: 'Second Home', amenities: ['Lift'] });
  assert.equal(fromArray.status, 201);
  assert.deepEqual(fromArray.body.data.property.amenities, ['Lift']);
});

test('a seller can update their own property but never the owner', async () => {
  const seller = await asSeller();
  const created = await createProperty(seller.token);
  const propertyId = created.body.data.property.id;

  const response = await request(app)
    .put(`/api/properties/${propertyId}`)
    .set('Authorization', `Bearer ${seller.token}`)
    .send({ askingPrice: 25900000, status: 'sold', owner: '507f1f77bcf86cd799439011' });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.property.askingPrice, 25900000);
  assert.equal(response.body.data.property.status, 'sold');
  assert.equal(response.body.data.property.owner, seller.id, 'owner must stay unchanged');
});

test('a seller cannot update or delete another seller property', async () => {
  const seller = await asSeller();
  const otherSeller = await asOtherSeller();
  const created = await createProperty(otherSeller.token);
  const propertyId = created.body.data.property.id;

  const update = await request(app)
    .put(`/api/properties/${propertyId}`)
    .set('Authorization', `Bearer ${seller.token}`)
    .send({ askingPrice: 1 });
  assert.equal(update.status, 403);
  assert.equal(update.body.code, 'PROPERTY_FORBIDDEN');

  const remove = await request(app)
    .delete(`/api/properties/${propertyId}`)
    .set('Authorization', `Bearer ${seller.token}`);
  assert.equal(remove.status, 403);
  assert.equal(await Property.countDocuments({}), 1, 'the property must survive a forbidden delete');
});

test('a seller can delete their own property', async () => {
  const seller = await asSeller();
  const created = await createProperty(seller.token);
  const propertyId = created.body.data.property.id;

  const response = await request(app)
    .delete(`/api/properties/${propertyId}`)
    .set('Authorization', `Bearer ${seller.token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.property.id, propertyId);
  assert.equal(await Property.countDocuments({}), 0);

  const afterDelete = await request(app).get(`/api/properties/${propertyId}`);
  assert.equal(afterDelete.status, 404);
  assert.equal(afterDelete.body.code, 'PROPERTY_NOT_FOUND');
});

test('a buyer cannot update or delete any property', async () => {
  const seller = await asSeller();
  const buyer = await asBuyer();
  const created = await createProperty(seller.token);
  const propertyId = created.body.data.property.id;

  const update = await request(app)
    .put(`/api/properties/${propertyId}`)
    .set('Authorization', `Bearer ${buyer.token}`)
    .send({ askingPrice: 1 });
  assert.equal(update.status, 403);

  const remove = await request(app)
    .delete(`/api/properties/${propertyId}`)
    .set('Authorization', `Bearer ${buyer.token}`);
  assert.equal(remove.status, 403);
  assert.equal(await Property.countDocuments({}), 1);
});

test('an admin can update and delete any property', async () => {
  const seller = await asSeller();
  const admin = await asAdmin();
  const created = await createProperty(seller.token);
  const propertyId = created.body.data.property.id;

  const update = await request(app)
    .put(`/api/properties/${propertyId}`)
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ askingPrice: 30000000, propertyType: 'villa' });
  assert.equal(update.status, 200);
  assert.equal(update.body.data.property.askingPrice, 30000000);
  assert.equal(update.body.data.property.propertyType, 'villa');
  assert.equal(update.body.data.property.owner, seller.id, 'admin edits must not reassign ownership');

  const remove = await request(app)
    .delete(`/api/properties/${propertyId}`)
    .set('Authorization', `Bearer ${admin.token}`);
  assert.equal(remove.status, 200);
  assert.equal(await Property.countDocuments({}), 0);
});

test('mutations require a valid token and return 401 without one', async () => {
  const created = await Property.create(propertyPayload({ owner: new mongoose.Types.ObjectId() }));
  const propertyId = created._id.toString();

  const post = await request(app).post('/api/properties').send(propertyPayload());
  assert.equal(post.status, 401);

  const put = await request(app).put(`/api/properties/${propertyId}`).send({ askingPrice: 1 });
  assert.equal(put.status, 401);

  const remove = await request(app).delete(`/api/properties/${propertyId}`);
  assert.equal(remove.status, 401);

  const badToken = await request(app)
    .put(`/api/properties/${propertyId}`)
    .set('Authorization', 'Bearer not-a-real-token')
    .send({ askingPrice: 1 });
  assert.equal(badToken.status, 401);
  assert.equal(badToken.body.code, 'INVALID_TOKEN');
});

test('invalid ids and unknown properties return 400 and 404', async () => {
  const seller = await asSeller();

  const invalidGet = await request(app).get('/api/properties/not-an-id');
  assert.equal(invalidGet.status, 400);
  assert.equal(invalidGet.body.code, 'INVALID_PROPERTY_ID');

  const invalidUpdate = await request(app)
    .put('/api/properties/not-an-id')
    .set('Authorization', `Bearer ${seller.token}`)
    .send({ askingPrice: 1 });
  assert.equal(invalidUpdate.status, 400);

  const invalidDelete = await request(app)
    .delete('/api/properties/not-an-id')
    .set('Authorization', `Bearer ${seller.token}`);
  assert.equal(invalidDelete.status, 400);

  const unknown = await request(app).get('/api/properties/507f1f77bcf86cd799439011');
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.code, 'PROPERTY_NOT_FOUND');

  const unknownUpdate = await request(app)
    .put('/api/properties/507f1f77bcf86cd799439011')
    .set('Authorization', `Bearer ${seller.token}`)
    .send({ askingPrice: 1 });
  assert.equal(unknownUpdate.status, 404);
});

test('GET /api/properties/mine only returns the signed-in seller listings', async () => {
  const seller = await asSeller();
  const otherSeller = await asOtherSeller();
  await createProperty(seller.token, { title: 'Seller One Home' });
  await createProperty(seller.token, { title: 'Seller One Villa' });
  await createProperty(otherSeller.token, { title: 'Seller Two Cottage' });

  const mine = await request(app)
    .get('/api/properties/mine')
    .set('Authorization', `Bearer ${seller.token}`);

  assert.equal(mine.status, 200);
  assert.equal(mine.body.data.pagination.total, 2);
  const titles = mine.body.data.properties.map((property) => property.title);
  assert.deepEqual(titles.sort(), ['Seller One Home', 'Seller One Villa']);
  assert.ok(
    mine.body.data.properties.every((property) => property.owner === seller.id),
    'every returned listing belongs to the caller',
  );
});

test('GET /api/properties/mine includes inactive listings and can filter by status', async () => {
  const seller = await asSeller();
  await createProperty(seller.token, { title: 'Retired Listing', status: 'inactive' });
  await createProperty(seller.token, { title: 'Live Listing' });

  const all = await request(app)
    .get('/api/properties/mine')
    .set('Authorization', `Bearer ${seller.token}`);
  assert.equal(all.body.data.pagination.total, 2, 'inactive listings stay visible to their owner');

  const inactive = await request(app)
    .get('/api/properties/mine')
    .query({ status: 'inactive' })
    .set('Authorization', `Bearer ${seller.token}`);
  assert.equal(inactive.body.data.pagination.total, 1);
  assert.equal(inactive.body.data.properties[0].title, 'Retired Listing');
});

test('GET /api/properties/mine paginates and rejects callers without seller access', async () => {
  const seller = await asSeller();
  await createProperty(seller.token, { title: 'Paginated One' });
  await createProperty(seller.token, { title: 'Paginated Two' });
  await createProperty(seller.token, { title: 'Paginated Three' });

  const firstPage = await request(app)
    .get('/api/properties/mine')
    .query({ page: 1, limit: 2 })
    .set('Authorization', `Bearer ${seller.token}`);
  assert.equal(firstPage.body.data.properties.length, 2);
  assert.deepEqual(firstPage.body.data.pagination, { page: 1, limit: 2, total: 3, pages: 2 });

  const secondPage = await request(app)
    .get('/api/properties/mine')
    .query({ page: 2, limit: 2 })
    .set('Authorization', `Bearer ${seller.token}`);
  assert.equal(secondPage.body.data.properties.length, 1);

  const buyer = await asBuyer();
  const asBuyerResponse = await request(app)
    .get('/api/properties/mine')
    .set('Authorization', `Bearer ${buyer.token}`);
  assert.equal(asBuyerResponse.status, 403);

  const anonymous = await request(app).get('/api/properties/mine');
  assert.equal(anonymous.status, 401);
});

test('a malformed JSON body is rejected without a stack trace', async () => {
  const seller = await asSeller();

  const response = await request(app)
    .post('/api/properties')
    .set('Authorization', `Bearer ${seller.token}`)
    .set('Content-Type', 'application/json')
    .send('{"title": "broken",,,}');

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, 'INVALID_JSON');
  assert.equal(response.body.stack, undefined);
});

test('an update with no editable fields is rejected', async () => {
  const seller = await asSeller();
  const created = await createProperty(seller.token);

  const response = await request(app)
    .put(`/api/properties/${created.body.data.property.id}`)
    .set('Authorization', `Bearer ${seller.token}`)
    .send({});

  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'NO_UPDATES_PROVIDED');
});

test('filters narrow the public listing', async () => {
  const owner = await User.create(accounts.seller);
  await Property.create(
    [
      propertyPayload({ title: 'Indiranagar Apartment' }),
      propertyPayload({ title: 'Whitefield Villa', propertyType: 'villa', locality: 'Whitefield', askingPrice: 38000000, builtUpArea: 2600, bedrooms: 4, city: 'Bengaluru' }),
      propertyPayload({ title: 'Marine Terrace', locality: 'Bandra West', city: 'Mumbai', askingPrice: 61500000, builtUpArea: 2140, bedrooms: 3, status: 'sold' }),
      propertyPayload({ title: 'Gardenline Retreat', propertyType: 'house', locality: 'Gurugram', city: 'Gurugram', askingPrice: 28750000, builtUpArea: 2450, status: 'inactive' }),
    ].map((payload) => ({ ...payload, owner: owner._id })),
  );

  const byLocality = await request(app).get('/api/properties').query({ locality: 'indiranagar' });
  assert.equal(byLocality.body.data.pagination.total, 1);
  assert.equal(byLocality.body.data.properties[0].title, 'Indiranagar Apartment');

  const byCity = await request(app).get('/api/properties').query({ city: 'Mumbai' });
  assert.equal(byCity.body.data.pagination.total, 1);

  const byType = await request(app).get('/api/properties').query({ propertyType: 'villa' });
  assert.equal(byType.body.data.pagination.total, 1);
  assert.equal(byType.body.data.properties[0].title, 'Whitefield Villa');

  const byPrice = await request(app).get('/api/properties').query({ minPrice: 30000000 });
  assert.equal(byPrice.body.data.pagination.total, 2, 'the inactive 2.875 Cr listing stays hidden by default');

  const byMaxPrice = await request(app).get('/api/properties').query({ maxPrice: 30000000 });
  assert.equal(byMaxPrice.body.data.pagination.total, 1);

  const byArea = await request(app).get('/api/properties').query({ minArea: 2400, maxArea: 2700 });
  assert.equal(byArea.body.data.pagination.total, 1);

  const byBedrooms = await request(app).get('/api/properties').query({ bedrooms: 4 });
  assert.equal(byBedrooms.body.data.pagination.total, 1);

  const byStatus = await request(app).get('/api/properties').query({ status: 'sold' });
  assert.equal(byStatus.body.data.pagination.total, 1);
  assert.equal(byStatus.body.data.properties[0].title, 'Marine Terrace');

  const inactiveHiddenByDefault = await request(app).get('/api/properties');
  assert.equal(
    inactiveHiddenByDefault.body.data.properties.some((property) => property.status === 'inactive'),
    false,
    'inactive listings stay hidden unless requested',
  );

  const combined = await request(app)
    .get('/api/properties')
    .query({ city: 'Bengaluru', propertyType: 'apartment', minPrice: 20000000, maxPrice: 30000000 });
  assert.equal(combined.body.data.pagination.total, 1);
  assert.equal(combined.body.data.properties[0].title, 'Indiranagar Apartment');
});

test('search matches title, locality and city', async () => {
  const owner = await User.create(accounts.seller);
  await Property.create(
    [
      propertyPayload({ title: 'Orchard View Apartment' }),
      propertyPayload({ title: 'Gardenline Retreat', locality: 'Gurugram', city: 'Gurugram', propertyType: 'house' }),
    ].map((payload) => ({ ...payload, owner: owner._id })),
  );

  const byTitle = await request(app).get('/api/properties').query({ search: 'orchard' });
  assert.equal(byTitle.body.data.pagination.total, 1);
  assert.equal(byTitle.body.data.properties[0].title, 'Orchard View Apartment');

  const byLocality = await request(app).get('/api/properties').query({ search: 'gurugram' });
  assert.equal(byLocality.body.data.pagination.total, 1);

  const byCity = await request(app).get('/api/properties').query({ search: 'Bengaluru' });
  assert.equal(byCity.body.data.pagination.total, 1);

  const noMatch = await request(app).get('/api/properties').query({ search: 'zzzz-not-here' });
  assert.equal(noMatch.body.data.pagination.total, 0);
  assert.deepEqual(noMatch.body.data.properties, []);
});

test('search escapes regex characters instead of failing', async () => {
  const owner = await User.create(accounts.seller);
  await Property.create(propertyPayload({ title: 'Plot (North) 12*5', owner: owner._id }));

  const response = await request(app).get('/api/properties').query({ search: '(North)' });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.pagination.total, 1);
});

test('pagination returns the requested page and clamps the limit', async () => {
  const owner = await User.create(accounts.seller);
  await Property.create(
    Array.from({ length: 5 }, (unused, index) =>
      propertyPayload({ title: `Paged Home ${index}`, owner: owner._id }),
    ),
  );

  const firstPage = await request(app).get('/api/properties').query({ page: 1, limit: 2 });
  assert.equal(firstPage.body.data.properties.length, 2);
  assert.deepEqual(firstPage.body.data.pagination, { page: 1, limit: 2, total: 5, pages: 3 });

  const lastPage = await request(app).get('/api/properties').query({ page: 3, limit: 2 });
  assert.equal(lastPage.body.data.properties.length, 1);

  const beyondEnd = await request(app).get('/api/properties').query({ page: 9, limit: 2 });
  assert.equal(beyondEnd.status, 200);
  assert.deepEqual(beyondEnd.body.data.properties, []);

  const clamped = await request(app).get('/api/properties').query({ limit: 5000 });
  assert.equal(clamped.body.data.pagination.limit, 50);

  const invalidPage = await request(app).get('/api/properties').query({ page: 0 });
  assert.equal(invalidPage.status, 400);
  assert.equal(invalidPage.body.code, 'INVALID_PROPERTY_FILTER');

  const invertedPrice = await request(app).get('/api/properties').query({ minPrice: 90000000, maxPrice: 100 });
  assert.equal(invertedPrice.status, 400);

  const badType = await request(app).get('/api/properties').query({ propertyType: 'castle' });
  assert.equal(badType.status, 400);
});

test('unauthenticated reads never expose a stack trace or internal error', async () => {
  const response = await request(app).get('/api/properties').query({ limit: 'abc' });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.stack, undefined);
  assert.equal(JSON.stringify(response.body).includes('at '), false);
});
