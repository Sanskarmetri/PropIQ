import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import request from 'supertest';
import {
  app,
  connectDatabase,
  disconnectDatabase,
  HistoricalPrice,
  mongoServer,
  Property,
  User,
} from './support/app.js';

// Imported dynamically for the same reason as the other suites:
// `support/app.js` sets the test environment after a top-level await.
const { handlePropValMessage } = await import('../services/propval/propvalService.js');
const { parseMessage } = await import('../services/propval/intentParser.js');
const { MESSAGES } = await import('../services/propval/responseBuilder.js');

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

// Two benchmark sets: one for the search fixtures in Whitefield and one for the
// single property used by the valuation, screening and similarity checks.
const WHITEFIELD_RATE = 5000;
const INDIRANAGAR_RATE = 14000;
const INDIRANAGAR_ESTIMATE = 28000000;

const seedBenchmark = (overrides = {}) =>
  HistoricalPrice.create({
    locality: 'Whitefield',
    city: 'Bengaluru',
    propertyType: 'apartment',
    averagePricePerSqFt: WHITEFIELD_RATE,
    sampleSize: 20,
    source: 'development-sample',
    period: '2025-sample',
    ...overrides,
  });

const seedIndiranagarBenchmark = () =>
  seedBenchmark({
    locality: 'Indiranagar',
    city: 'Bengaluru',
    averagePricePerSqFt: INDIRANAGAR_RATE,
  });

const listingInput = (overrides = {}) => ({
  title: 'Sunlit Courtyard Residence',
  description: 'A calm, light-filled apartment.',
  locality: 'Indiranagar',
  city: 'Bengaluru',
  propertyType: 'apartment',
  builtUpArea: 2000,
  bedrooms: 3,
  bathrooms: 2,
  propertyAge: 1,
  amenities: [],
  askingPrice: INDIRANAGAR_ESTIMATE,
  ...overrides,
});

let ownerCount = 0;
const createOwner = () =>
  User.create({
    name: 'Diya Menon',
    email: `seller-${(ownerCount += 1)}@example.com`,
    password: 'Str0ng-PropIQ-Password',
    role: 'seller',
  });

const createListing = async (overrides = {}) => {
  const owner = await createOwner();
  return Property.create(listingInput({ owner: owner._id, ...overrides }));
};

/**
 * The search fixture set is sized so the headline PropVal questions have exact,
 * checkable answers: two 3BHKs under a crore in Whitefield, two 2BHKs under
 * 80 lakhs, and two listings with parking.
 */
const seedSearchListings = async () => {
  await Promise.all([
    createListing({
      title: 'Whitefield Park View 3BHK',
      locality: 'Whitefield',
      builtUpArea: 1500,
      bedrooms: 3,
      askingPrice: 7500000,
      amenities: ['Covered parking'],
    }),
    createListing({
      title: 'Whitefield Lake Side 3BHK',
      locality: 'Whitefield',
      builtUpArea: 1800,
      bedrooms: 3,
      askingPrice: 9200000,
      amenities: [],
    }),
    createListing({
      title: 'Whitefield Compact 2BHK',
      locality: 'Whitefield',
      builtUpArea: 1200,
      bedrooms: 2,
      askingPrice: 7800000,
      amenities: [],
    }),
    createListing({
      title: 'Koramangala Cozy 2BHK',
      locality: 'Koramangala',
      builtUpArea: 1100,
      bedrooms: 2,
      askingPrice: 6900000,
      amenities: [],
    }),
    createListing({
      title: 'Indiranagar Spacious 2BHK',
      locality: 'Indiranagar',
      builtUpArea: 1600,
      bedrooms: 2,
      askingPrice: 20500000,
      amenities: ['Gym', 'Pool'],
    }),
    createListing({
      title: 'Bandra West Sea Breeze 2BHK',
      locality: 'Bandra West',
      city: 'Mumbai',
      builtUpArea: 1250,
      bedrooms: 2,
      askingPrice: 8400000,
      amenities: ['Reserved parking'],
    }),
  ]);
};

const ask = (body) => request(app).post('/api/propval').send(body);
const askService = (message, context = {}) => handlePropValMessage({ message, context });

const whitefieldContext = (property) => ({
  currentRoute: '/properties/:id',
  currentPropertyId: property._id.toString(),
  lastSearch: { locality: 'Whitefield', bedrooms: 3 },
  lastSearchResultCount: 2,
});

const titlesOf = (results) => results.map((property) => property.title).sort();

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
  await Promise.all([HistoricalPrice.deleteMany({}), Property.deleteMany({}), User.deleteMany({})]);
});

/* -------------------------------------------------------------------------- */
/* 1. Greeting                                                                 */
/* -------------------------------------------------------------------------- */

test('greets the user without touching the database', async () => {
  const response = await ask({ message: 'Hi' });
  const { data } = response.body;

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(data.intent, 'GREETING');
  assert.equal(data.message, MESSAGES.greeting);
  assert.equal(data.action, 'NONE');
  assert.deepEqual(data.results, []);
});

test('treats hello and hey as the same greeting intent', async () => {
  for (const message of ['hello', 'hey']) {
    const response = await ask({ message });
    assert.equal(response.body.data.intent, 'GREETING');
    assert.equal(response.body.data.message, MESSAGES.greeting);
  }
});

/* -------------------------------------------------------------------------- */
/* 2. Help                                                                     */
/* -------------------------------------------------------------------------- */

test('describes only the capabilities PropVal actually implements', async () => {
  const response = await ask({ message: 'help' });
  const { data } = response.body;

  assert.equal(data.intent, 'HELP');
  assert.equal(data.action, 'NONE');
  assert.match(data.message, /find a property/i);
  assert.match(data.message, /worth|value/i);
  assert.doesNotMatch(data.message, /\bfraud\b|\bscam\b|\bguarantee/i);
});

test('answers what can you do with the same capability list', async () => {
  const response = await ask({ message: 'what can you do' });
  assert.equal(response.body.data.intent, 'HELP');
});

/* -------------------------------------------------------------------------- */
/* 3. Property search                                                          */
/* -------------------------------------------------------------------------- */

test('searches by bedrooms when only bedrooms are given', async () => {
  await seedSearchListings();
  const response = await ask({ message: '3BHK in Whitefield' });
  const { data } = response.body;

  assert.equal(data.intent, 'PROPERTY_SEARCH');
  assert.equal(data.action, 'PROPERTY_SEARCH');
  assert.equal(data.entities.bedrooms, 3);
  assert.equal(data.entities.locality, 'Whitefield');
  assert.deepEqual(titlesOf(data.results), ['Whitefield Lake Side 3BHK', 'Whitefield Park View 3BHK']);
});

test('searches by budget when only a budget is given', async () => {
  await seedSearchListings();
  const response = await ask({ message: '2 bhk under 80 lakhs' });
  const { data } = response.body;

  assert.equal(data.intent, 'PROPERTY_SEARCH');
  assert.equal(data.entities.bedrooms, 2);
  assert.equal(data.entities.maxPrice, 8000000);
  assert.deepEqual(titlesOf(data.results), ['Koramangala Cozy 2BHK', 'Whitefield Compact 2BHK']);
});

test('searches by property type', async () => {
  await seedSearchListings();
  const response = await ask({ message: 'apartment below 1 crore' });
  const { data } = response.body;

  assert.equal(data.entities.propertyType, 'apartment');
  assert.equal(data.entities.maxPrice, 10000000);
  assert.equal(data.results.length, 5);
  assert.ok(data.results.every((property) => property.askingPrice < 10000000));
});

test('searches by locality', async () => {
  await seedSearchListings();
  const response = await ask({ message: 'villa in Indiranagar' });
  const { data } = response.body;

  assert.equal(data.entities.locality, 'Indiranagar');
  assert.equal(data.entities.propertyType, 'villa');
  assert.equal(data.results.length, 0);
  assert.equal(data.message, MESSAGES.noResults);
});

test('searches by amenities', async () => {
  await seedSearchListings();
  const response = await ask({ message: 'property with parking' });
  const { data } = response.body;

  assert.deepEqual(data.entities.amenities, ['Covered parking']);
  assert.deepEqual(titlesOf(data.results), [
    'Bandra West Sea Breeze 2BHK',
    'Whitefield Park View 3BHK',
  ]);
});

test('searches with a fractional crore ceiling', async () => {
  await seedSearchListings();
  const response = await ask({ message: 'under 1.2 crore 3bhk' });
  const { data } = response.body;

  assert.equal(data.entities.maxPrice, 12000000);
  assert.equal(data.entities.bedrooms, 3);
  assert.equal(data.results.length, 2);
});

test('reads a between range and applies both ends of it', async () => {
  await seedSearchListings();
  const response = await ask({ message: 'between 50 and 80 lakhs' });
  const { data } = response.body;

  assert.equal(data.entities.minPrice, 5000000);
  assert.equal(data.entities.maxPrice, 8000000);
  assert.deepEqual(titlesOf(data.results), [
    'Koramangala Cozy 2BHK',
    'Whitefield Compact 2BHK',
    'Whitefield Park View 3BHK',
  ]);
});

test('combines locality, bedrooms and budget in one request', async () => {
  await seedSearchListings();
  const response = await ask({ message: 'Find me a 3BHK in Whitefield under 1 crore' });
  const { data } = response.body;

  assert.equal(data.intent, 'PROPERTY_SEARCH');
  assert.equal(data.entities.bedrooms, 3);
  assert.equal(data.entities.locality, 'Whitefield');
  assert.equal(data.entities.city, 'Bengaluru');
  assert.equal(data.entities.maxPrice, 10000000);
  assert.equal(data.results.length, 2);
  assert.ok(data.results.every((property) => property.bedrooms === 3 && property.askingPrice <= 10000000));
});

test('returns every filter it used so the client can explain the search', async () => {
  await seedSearchListings();
  const response = await ask({ message: '2 bhk under 80 lakhs' });
  const { data } = response.body;

  assert.deepEqual(Object.keys(data.entities).sort(), ['bedrooms', 'maxPrice']);
});

/* -------------------------------------------------------------------------- */
/* 4. Property details                                                         */
/* -------------------------------------------------------------------------- */

test('returns details for the property in context', async () => {
  const property = await createListing();
  const response = await ask({ message: 'tell me about this property', context: whitefieldContext(property) });
  const { data } = response.body;

  assert.equal(data.intent, 'PROPERTY_DETAILS');
  assert.equal(data.action, 'PROPERTY_DETAILS');
  assert.equal(data.property.id, property._id.toString());
  assert.equal(data.results.length, 1);
  assert.match(data.message, /Sunlit Courtyard Residence/);
});

test('asks the user to open a property when details are requested without context', async () => {
  const response = await ask({ message: 'show details' });
  const { data } = response.body;

  assert.equal(data.intent, 'PROPERTY_DETAILS');
  assert.equal(data.message, MESSAGES.detailsContext);
  assert.deepEqual(data.results, []);
});

test('reads a details request phrased as a question about the listing', async () => {
  const property = await createListing();
  const response = await ask({
    message: 'what are the details of this listing?',
    context: { currentPropertyId: property._id.toString() },
  });

  assert.equal(response.body.data.intent, 'PROPERTY_DETAILS');
  assert.equal(response.body.data.property.id, property._id.toString());
});

/* -------------------------------------------------------------------------- */
/* 5. Valuation                                                                */
/* -------------------------------------------------------------------------- */

test('values the property in context with the valuation service', async () => {
  await seedIndiranagarBenchmark();
  const property = await createListing();
  const response = await ask({ message: 'what is this property worth?', context: whitefieldContext(property) });
  const { data } = response.body;

  assert.equal(data.intent, 'VALUATION');
  assert.equal(data.action, 'VALUATION');
  assert.equal(data.valuation.estimatedValue, INDIRANAGAR_ESTIMATE);
  assert.match(data.message, /₹2\.8 crore/);
});

test('values the property in context when the user asks for an estimate', async () => {
  await seedIndiranagarBenchmark();
  const property = await createListing();
  const response = await ask({ message: 'estimate the value', context: { currentPropertyId: property._id.toString() } });

  assert.equal(response.body.data.intent, 'VALUATION');
  assert.equal(response.body.data.valuation.estimatedValue, INDIRANAGAR_ESTIMATE);
});

test('values the property in context when the user asks what it should cost', async () => {
  await seedIndiranagarBenchmark();
  const property = await createListing();
  const response = await ask({ message: 'what should this property cost?', context: { currentPropertyId: property._id.toString() } });

  assert.equal(response.body.data.intent, 'VALUATION');
  assert.equal(response.body.data.valuation.estimatedValue, INDIRANAGAR_ESTIMATE);
});

test('values the property in context when the user asks for a valuation report', async () => {
  await seedIndiranagarBenchmark();
  const property = await createListing();
  const response = await ask({ message: 'give me a valuation', context: { currentPropertyId: property._id.toString() } });

  assert.equal(response.body.data.intent, 'VALUATION');
  assert.equal(response.body.data.valuation.estimatedValue, INDIRANAGAR_ESTIMATE);
});

test('asks for a property when a valuation is requested without context', async () => {
  const response = await ask({ message: 'what is this property worth?' });
  const { data } = response.body;

  assert.equal(data.intent, 'VALUATION');
  assert.equal(data.message, MESSAGES.valuationContext);
  assert.equal(data.valuation, null);
});

test('explains that a benchmark is missing instead of inventing an estimate', async () => {
  const property = await createListing();
  const response = await ask({
    message: 'what is this property worth?',
    context: { currentPropertyId: property._id.toString() },
  });
  const { data } = response.body;

  assert.equal(data.intent, 'VALUATION');
  assert.equal(data.valuation, null);
  assert.equal(data.message, MESSAGES.benchmarkUnavailable);
});

/* -------------------------------------------------------------------------- */
/* 6. Price analysis                                                           */
/* -------------------------------------------------------------------------- */

test('compares the asking price with the estimate when asked if it is overpriced', async () => {
  await seedIndiranagarBenchmark();
  const property = await createListing({ askingPrice: INDIRANAGAR_ESTIMATE * 1.4 });
  const response = await ask({ message: 'is this overpriced?', context: whitefieldContext(property) });
  const { data } = response.body;

  assert.equal(data.intent, 'PRICE_ANALYSIS');
  assert.equal(data.action, 'FRAUD_SCREENING');
  assert.equal(data.valuation.estimatedValue, INDIRANAGAR_ESTIMATE);
  assert.equal(data.screening.flags.find((flag) => flag.type === 'PRICE_DEVIATION').triggered, true);
  assert.match(data.message, /above the current PropIQ estimate/);
});

test('reports a fairly priced listing without raising a flag', async () => {
  await seedIndiranagarBenchmark();
  const property = await createListing();
  const response = await ask({ message: 'is this property fairly priced?', context: whitefieldContext(property) });
  const { data } = response.body;

  assert.equal(data.intent, 'PRICE_ANALYSIS');
  assert.equal(data.screening.flags.find((flag) => flag.type === 'PRICE_DEVIATION').triggered, false);
  assert.match(data.message, /normal pricing range/);
});

test('compares the asking price when the user asks how it stacks up', async () => {
  await seedIndiranagarBenchmark();
  const property = await createListing();
  const response = await ask({ message: 'how does the asking price compare?', context: { currentPropertyId: property._id.toString() } });
  const { data } = response.body;

  assert.equal(data.intent, 'PRICE_ANALYSIS');
  assert.equal(data.screening.flags.length, 2);
});

test('explains a high asking price in neutral language', async () => {
  await seedIndiranagarBenchmark();
  const property = await createListing({ askingPrice: INDIRANAGAR_ESTIMATE * 1.25 });
  const response = await ask({ message: 'why is the price high?', context: { currentPropertyId: property._id.toString() } });
  const { data } = response.body;

  assert.equal(data.intent, 'PRICE_ANALYSIS');
  assert.match(data.message, /potentially unusual pricing|worth a look/);
  assert.doesNotMatch(data.message, /\bfraud|\bscam|fraudulent|lying/i);
});

test('asks the user to open a property when pricing is compared without context', async () => {
  const response = await ask({ message: 'is this overpriced?' });
  const { data } = response.body;

  assert.equal(data.intent, 'PRICE_ANALYSIS');
  assert.equal(data.message, MESSAGES.screeningContext);
  assert.deepEqual(data.results, []);
});

/* -------------------------------------------------------------------------- */
/* 7. Screening explanation                                                    */
/* -------------------------------------------------------------------------- */

test('explains why a property was flagged', async () => {
  await seedIndiranagarBenchmark();
  const property = await createListing({ askingPrice: INDIRANAGAR_ESTIMATE * 1.4 });
  const response = await ask({ message: 'why was this property flagged?', context: whitefieldContext(property) });
  const { data } = response.body;

  assert.equal(data.intent, 'FRAUD_EXPLANATION');
  assert.equal(data.action, 'FRAUD_SCREENING');
  assert.equal(data.screening.status !== 'clear', true);
  assert.match(data.message, /pricing anomaly/);
  assert.doesNotMatch(data.message, /\bfraud|\bscam|fraudulent/i);
});

test('explains a screening when the listing is described as suspicious', async () => {
  await seedIndiranagarBenchmark();
  const property = await createListing({ askingPrice: INDIRANAGAR_ESTIMATE * 1.4 });
  const response = await ask({ message: 'why is this listing suspicious?', context: { currentPropertyId: property._id.toString() } });
  const { data } = response.body;

  assert.equal(data.intent, 'FRAUD_EXPLANATION');
  assert.match(data.message, /pricing anomaly/);
});

test('explains a screening when the user asks what caused it', async () => {
  await seedIndiranagarBenchmark();
  const property = await createListing({ askingPrice: INDIRANAGAR_ESTIMATE * 1.4 });
  const response = await ask({ message: 'what caused the screening?', context: { currentPropertyId: property._id.toString() } });
  const { data } = response.body;

  assert.equal(data.intent, 'FRAUD_EXPLANATION');
  assert.ok(data.screening.flags.length > 0);
});

test('explains a clean screening without inventing a flag', async () => {
  await seedIndiranagarBenchmark();
  const property = await createListing();
  const response = await ask({ message: 'explain the screening', context: { currentPropertyId: property._id.toString() } });
  const { data } = response.body;

  assert.equal(data.intent, 'FRAUD_EXPLANATION');
  assert.equal(data.screening.status, 'clear');
  assert.match(data.message, /No pricing anomaly or similar active listing/);
});

test('asks the user to open a property when a screening is explained without context', async () => {
  const response = await ask({ message: 'why was this property flagged?' });
  const { data } = response.body;

  assert.equal(data.intent, 'FRAUD_EXPLANATION');
  assert.equal(data.message, MESSAGES.fraudContext);
  assert.equal(data.screening, null);
});

/* -------------------------------------------------------------------------- */
/* 8. Similar properties                                                       */
/* -------------------------------------------------------------------------- */

test('returns similar listings for the property in context', async () => {
  await seedIndiranagarBenchmark();
  const subject = await createListing({ title: 'Subject Residence' });
  await createListing({ title: 'Neighbouring Residence', askingPrice: INDIRANAGAR_ESTIMATE + 500000 });
  const response = await ask({ message: 'show similar properties', context: whitefieldContext(subject) });
  const { data } = response.body;

  assert.equal(data.intent, 'SIMILAR_PROPERTIES');
  assert.ok(data.results.length > 0);
  assert.ok(data.results.every((property) => property.id !== subject._id.toString()));
});

test('suggests alternatives when the user asks for something like the current property', async () => {
  await seedIndiranagarBenchmark();
  const subject = await createListing({ title: 'Subject Residence' });
  await createListing({ title: 'Neighbouring Residence' });
  const response = await ask({ message: 'find something like this', context: { currentPropertyId: subject._id.toString() } });

  assert.equal(response.body.data.intent, 'SIMILAR_PROPERTIES');
  assert.ok(response.body.data.results.length > 0);
});

test('returns similar listings when the user asks for alternatives', async () => {
  await seedIndiranagarBenchmark();
  const subject = await createListing({ title: 'Subject Residence' });
  await createListing({ title: 'Neighbouring Residence' });
  const response = await ask({ message: 'show alternatives', context: { currentPropertyId: subject._id.toString() } });

  assert.equal(response.body.data.intent, 'SIMILAR_PROPERTIES');
  assert.ok(response.body.data.results.length > 0);
});

test('returns similar listings when the user asks for similar listings', async () => {
  await seedIndiranagarBenchmark();
  const subject = await createListing({ title: 'Subject Residence' });
  await createListing({ title: 'Neighbouring Residence' });
  const response = await ask({ message: 'show me similar listings', context: { currentPropertyId: subject._id.toString() } });

  assert.equal(response.body.data.intent, 'SIMILAR_PROPERTIES');
  assert.ok(response.body.data.results.length > 0);
});

test('asks the user to open a property when similar listings are requested without context', async () => {
  const response = await ask({ message: 'show similar properties' });
  const { data } = response.body;

  assert.equal(data.intent, 'SIMILAR_PROPERTIES');
  assert.equal(data.message, MESSAGES.similarContext);
  assert.deepEqual(data.results, []);
});

/* -------------------------------------------------------------------------- */
/* 9. Zero results and unresolvable input                                      */
/* -------------------------------------------------------------------------- */

test('returns an empty result set for a search that matches nothing', async () => {
  await seedSearchListings();
  const response = await ask({ message: '4BHK in Whitefield' });
  const { data } = response.body;

  assert.equal(data.intent, 'PROPERTY_SEARCH');
  assert.deepEqual(data.results, []);
  assert.equal(data.message, MESSAGES.noResults);
});

test('passes an unknown locality through unchanged instead of guessing', async () => {
  await seedSearchListings();
  const response = await ask({ message: '2 bhk in Necronopolis' });
  const { data } = response.body;

  assert.equal(data.entities.locality, 'Necronopolis');
  assert.deepEqual(data.results, []);
  assert.equal(data.message, MESSAGES.noResults);
});

test('explains that it does not understand an unsupported request', async () => {
  const response = await ask({ message: 'what is the weather tomorrow' });
  const { data } = response.body;

  assert.equal(data.intent, 'UNKNOWN');
  assert.equal(data.action, 'NONE');
  assert.equal(data.message, MESSAGES.unknown);
  assert.deepEqual(data.results, []);
});

test('reports a property id that is not in the database', async () => {
  const response = await ask({
    message: 'tell me about this property',
    context: { currentPropertyId: '65f0c1a2b3c4d5e6f7a8b9c0' },
  });
  const { data } = response.body;

  assert.equal(data.intent, 'PROPERTY_DETAILS');
  assert.equal(data.message, MESSAGES.propertyNotFound);
  assert.deepEqual(data.results, []);
});

/* -------------------------------------------------------------------------- */
/* 10. Context handling                                                        */
/* -------------------------------------------------------------------------- */

test('returns the context it used so the client can track the conversation', async () => {
  await seedSearchListings();
  const response = await ask({
    message: '2 bhk under 80 lakhs',
    context: { currentRoute: '/explore', lastSearch: { bedrooms: 2 }, lastSearchResultCount: 2 },
  });
  const { data } = response.body;

  assert.equal(data.context.currentRoute, '/explore');
  assert.equal(data.context.currentPropertyId, null);
  assert.deepEqual(data.context.lastSearch, { bedrooms: 2 });
  assert.equal(data.context.lastSearchResultCount, 2);
});

test('ignores a malformed property id in context rather than failing', async () => {
  const response = await request(app)
    .post('/api/propval')
    .send({ message: 'what is this property worth?', context: { currentPropertyId: 'not-an-id' } });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, 'PROPVAL_VALIDATION_FAILED');
  assert.equal(response.body.details['context.currentPropertyId'], 'Current property id is invalid');
});

/* -------------------------------------------------------------------------- */
/* 11. Determinism                                                             */
/* -------------------------------------------------------------------------- */

test('returns an identical answer when the same message is asked twice', async () => {
  await seedIndiranagarBenchmark();
  const property = await createListing({ askingPrice: INDIRANAGAR_ESTIMATE * 1.3 });
  const context = whitefieldContext(property);

  const first = await askService('is this overpriced?', context);
  const second = await askService('is this overpriced?', context);

  assert.deepEqual(first, second);
});

test('returns an identical search for a repeated query', async () => {
  await seedSearchListings();

  const first = await askService('3BHK in Whitefield under 1 crore');
  const second = await askService('3BHK in Whitefield under 1 crore');

  assert.deepEqual(first, second);
});

/* -------------------------------------------------------------------------- */
/* 12. Request validation and safe input                                       */
/* -------------------------------------------------------------------------- */

test('rejects a request with no message', async () => {
  const response = await ask({});

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, 'PROPVAL_VALIDATION_FAILED');
  assert.equal(response.body.details.message, 'Message must be text');
});

test('rejects a request with an empty message', async () => {
  const response = await ask({ message: '   ' });

  assert.equal(response.status, 400);
  assert.equal(response.body.details.message, 'Message cannot be empty');
});

test('rejects a message longer than the allowed length', async () => {
  const response = await ask({ message: 'a'.repeat(501) });

  assert.equal(response.status, 400);
  assert.match(response.body.details.message, /500 characters or fewer/);
});

test('rejects a request that is not an object', async () => {
  const response = await request(app).post('/api/propval').send(['find me a 3BHK']);

  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'INVALID_BODY');
});

test('rejects an unsupported context field instead of forwarding it', async () => {
  const response = await ask({ message: 'hi', context: { role: 'admin', currentPropertyId: { $ne: null } } });

  assert.equal(response.status, 400);
  assert.equal(response.body.details['context.role'], 'Context field is not supported');
  assert.equal(response.body.details['context.currentPropertyId'], 'Current property id is invalid');
});

test('treats an operator injection attempt as ordinary text', async () => {
  await seedSearchListings();
  const response = await ask({ message: 'properties in { $ne: null }' });
  const { data } = response.body;

  assert.equal(response.status, 200);
  assert.equal(data.intent, 'PROPERTY_SEARCH');
  assert.deepEqual(data.results, []);
  assert.equal(await Property.countDocuments({}), 6);
});

test('escapes hostile filter values instead of building a MongoDB operator', async () => {
  const { buildPropertyFilter } = await import('../services/propertyService.js');

  const hostile = buildPropertyFilter({
    locality: { $ne: null },
    city: '.*',
    amenities: ['parking', { $gt: '' }],
  });

  assert.ok(hostile.locality instanceof RegExp);
  assert.ok(hostile.city instanceof RegExp);
  assert.ok(hostile.amenities.$all.every((clause) => clause instanceof RegExp));
  assert.equal(hostile.$where, undefined);
  assert.equal(hostile.$or, undefined);
});

test('never evaluates a message as code', async () => {
  const response = await ask({ message: "process.exit(1) && require('fs')" });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.intent, 'UNKNOWN');
});

test('answers with the documented response envelope', async () => {
  await seedSearchListings();
  const response = await ask({ message: '2 bhk under 80 lakhs' });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(
    Object.keys(response.body.data).filter((key) => ['intent', 'action', 'message', 'entities', 'results'].includes(key)).sort(),
    ['action', 'entities', 'intent', 'message', 'results'],
  );
});

/* -------------------------------------------------------------------------- */
/* 13. Parser level guarantees                                                 */
/* -------------------------------------------------------------------------- */

test('parses every supported intent deterministically at the parser level', () => {
  const expectations = [
    ['Hi', 'GREETING'],
    ['hello', 'GREETING'],
    ['hey', 'GREETING'],
    ['help', 'HELP'],
    ['what can you do', 'HELP'],
    ['3BHK in Whitefield', 'PROPERTY_SEARCH'],
    ['2 bhk under 80 lakhs', 'PROPERTY_SEARCH'],
    ['apartment below 1 crore', 'PROPERTY_SEARCH'],
    ['villa in Indiranagar', 'PROPERTY_SEARCH'],
    ['property with parking', 'PROPERTY_SEARCH'],
    ['under 1.2 crore 3bhk', 'PROPERTY_SEARCH'],
    ['between 50 and 80 lakhs', 'PROPERTY_SEARCH'],
    ['tell me about this property', 'PROPERTY_DETAILS'],
    ['show details', 'PROPERTY_DETAILS'],
    ['what are the details of this listing?', 'PROPERTY_DETAILS'],
    ['what is this property worth?', 'VALUATION'],
    ['estimate the value', 'VALUATION'],
    ['what should this property cost?', 'VALUATION'],
    ['give me a valuation', 'VALUATION'],
    ['is this overpriced?', 'PRICE_ANALYSIS'],
    ['is this property fairly priced?', 'PRICE_ANALYSIS'],
    ['how does the asking price compare?', 'PRICE_ANALYSIS'],
    ['why is the price high?', 'PRICE_ANALYSIS'],
    ['why was this property flagged?', 'FRAUD_EXPLANATION'],
    ['why is this listing suspicious?', 'FRAUD_EXPLANATION'],
    ['what caused the screening?', 'FRAUD_EXPLANATION'],
    ['explain the screening', 'FRAUD_EXPLANATION'],
    ['show similar properties', 'SIMILAR_PROPERTIES'],
    ['find something like this', 'SIMILAR_PROPERTIES'],
    ['show alternatives', 'SIMILAR_PROPERTIES'],
    ['show me similar listings', 'SIMILAR_PROPERTIES'],
    ['what is the weather tomorrow', 'UNKNOWN'],
  ];

  for (const [message, intent] of expectations) {
    assert.equal(parseMessage(message).intent, intent, `"${message}" should parse as ${intent}`);
  }
});

test('normalises casing, spacing and trailing punctuation before matching', () => {
  assert.equal(parseMessage('  FIND   ME   A 3BHK!!!  ').entities.bedrooms, 3);
  assert.equal(parseMessage('Find me a 3BHK!!!').intent, 'PROPERTY_SEARCH');
});

/* -------------------------------------------------------------------------- */
/* 14. Analytics questions (admin only)                                        */
/* -------------------------------------------------------------------------- */

const ADMIN_ACCOUNT = { name: 'PropIQ Admin', email: 'admin@example.com', password: 'Str0ng-PropIQ-Password' };
const SELLER_ACCOUNT = { name: 'Diya Menon', email: 'seller@example.com', password: 'Str0ng-PropIQ-Password' };

/** Registers the account if needed, sets the role and returns a fresh token. */
const sessionFor = async (account, role) => {
  const existing = await User.findOne({ email: account.email });
  if (!existing) {
    const registration = await request(app).post('/api/auth/register').send(account);
    assert.equal(registration.status, 201, JSON.stringify(registration.body));
  }
  await User.updateOne({ email: account.email }, { $set: { role } });

  const login = await request(app).post('/api/auth/login').send({ email: account.email, password: account.password });
  assert.equal(login.status, 200);
  return login.body.data.token;
};

const askAs = (message, token) =>
  request(app).post('/api/propval').set('Authorization', `Bearer ${token}`).send({ message });

// Each test clears the users, so a new token is issued per test rather than cached.
const signedInAdmin = () => sessionFor(ADMIN_ACCOUNT, 'admin');
const signedInSeller = () => sessionFor(SELLER_ACCOUNT, 'seller');

/**
 * Two cities and three property types, sized so every analytics figure in the
 * assertions below is exact rather than approximate.
 */
const seedAnalyticsListings = async () => {
  await Promise.all([
    createListing({ title: 'Indiranagar Calm 3BHK', builtUpArea: 2000, askingPrice: 28000000, bedrooms: 3 }),
    createListing({ title: 'Indiranagar Bright 2BHK', builtUpArea: 1000, askingPrice: 14000000, bedrooms: 2 }),
    createListing({ title: 'Indiranagar Garden Villa', propertyType: 'villa', builtUpArea: 2800, askingPrice: 42000000 }),
    createListing({ title: 'Bandra West Sea Breeze', city: 'Mumbai', locality: 'Bandra West', builtUpArea: 1250, askingPrice: 31000000 }),
  ]);
};

test('an analytics question is refused without an admin session', async () => {
  await seedAnalyticsListings();
  const response = await ask({ message: 'How many listings are in PropIQ?' });
  const { data } = response.body;

  assert.equal(response.status, 200);
  assert.equal(data.intent, 'MARKET_ANALYTICS');
  assert.equal(data.analyticsForbidden, true);
  assert.equal(data.analytics, null);
  assert.equal(data.analyticsScope, null);
  assert.deepEqual(data.results, []);
  assert.match(data.message, /limited to admin accounts/i);
  assert.doesNotMatch(data.message, /\d/, 'a refusal must not leak any figure');
});

test('a signed-in seller is refused the same way as a visitor', async () => {
  await seedAnalyticsListings();
  const response = await askAs('Show the listing analytics', await signedInSeller());

  assert.equal(response.body.data.intent, 'MARKET_ANALYTICS');
  assert.equal(response.body.data.analyticsForbidden, true);
  assert.equal(response.body.data.analytics, null);
});

test('an admin gets real figures from the analytics service', async () => {
  await seedAnalyticsListings();
  const response = await askAs('How many listings are in PropIQ?', await signedInAdmin());
  const { data } = response.body;

  assert.equal(data.intent, 'MARKET_ANALYTICS');
  assert.equal(data.action, 'MARKET_ANALYTICS');
  assert.equal(data.analyticsForbidden, false);
  assert.ok(data.analytics, 'an admin receives the analytics payload');
  assert.equal(data.analytics.kpis.totalListings, 4);
  assert.equal(data.analytics.kpis.activeListings, 4);
  // 2.80 Cr + 1.40 Cr + 4.20 Cr + 3.10 Cr over 4 listings
  assert.equal(data.analytics.kpis.averageAskingPrice, 28750000);
  assert.match(data.message, /4 listings/);
  assert.match(data.message, /Bengaluru holds the most listings/);
});

test('an analytics question honours the place in the message', async () => {
  await seedAnalyticsListings();
  const response = await askAs('Show the analytics in Mumbai', await signedInAdmin());
  const { data } = response.body;

  assert.equal(data.analytics.kpis.totalListings, 1);
  assert.equal(data.analytics.kpis.averageAskingPrice, 31000000);
  assert.equal(data.analyticsScope.city, 'Mumbai');
  assert.match(data.message, /in Mumbai/);
});

test('an admin asking about a property type gets that breakdown', async () => {
  await seedAnalyticsListings();
  const response = await askAs('How many villa listings are there?', await signedInAdmin());

  assert.equal(response.body.data.analytics.kpis.totalListings, 1);
  assert.equal(response.body.data.analyticsScope.propertyType, 'villa');
});

test('an empty scope is reported plainly rather than as zeros', async () => {
  await seedAnalyticsListings();
  const response = await askAs('Show the analytics in Chennai', await signedInAdmin());
  const { data } = response.body;

  assert.equal(data.analytics.kpis.empty, true);
  assert.equal(data.analytics.kpis.totalListings, 0);
  assert.equal(data.message, MESSAGES.analyticsEmpty);
  assert.deepEqual(data.results, []);
});

test('flagged listings are returned as ordinary listings', async () => {
  await seedIndiranagarBenchmark();
  await createListing({ title: 'Clear Market Flat', builtUpArea: 2000, askingPrice: 28000000, bedrooms: 3 });
  await createListing({
    title: 'Heavily Overpriced Flat',
    builtUpArea: 900,
    askingPrice: 40000000,
    bedrooms: 1,
    bathrooms: 1,
    propertyAge: 0,
  });

  const response = await askAs('How many listings are flagged for review?', await signedInAdmin());
  const { data } = response.body;

  assert.equal(data.analytics.screening.ruleTriggers.PRICE_DEVIATION, 1);
  assert.deepEqual(titlesOf(data.results), ['Heavily Overpriced Flat']);
  assert.ok(data.results[0].id, 'a flagged listing can be opened from the answer');
  assert.ok(!('owner' in data.results[0]), 'a flagged listing must not expose the owner');
  assert.match(data.message, /flagged 1 listing for review/);
});

test('only an admin is told analytics exist', async () => {
  const anonymous = await ask({ message: 'help' });
  assert.doesNotMatch(anonymous.body.data.message, /analytics/i);
  assert.ok(anonymous.body.data.suggestions.every((prompt) => !/analytics|flagged for review/i.test(prompt)));

  const admin = await askAs('help', await signedInAdmin());
  assert.match(admin.body.data.message, /summarise listing volume/i);
  assert.ok(admin.body.data.suggestions.some((prompt) => /How many listings are in PropIQ/i.test(prompt)));
});

test('analytics questions are detected without capturing ordinary questions', () => {
  const analytics = [
    'How many listings are in PropIQ?',
    'How many listings are flagged?',
    'Show the listing analytics',
    'Give me a market overview',
    'What is the inventory?',
    'Show listing volume by city',
    'Which locality is most listed?',
    'Average price by city',
    'Show the median price',
    'Give me a price range summary',
    'Summarise the market',
  ];

  for (const message of analytics) {
    assert.equal(parseMessage(message).intent, 'MARKET_ANALYTICS', `"${message}" should parse as MARKET_ANALYTICS`);
  }

  // A "how many" question with a search constraint stays a search, and the
  // existing single-property questions are untouched.
  const unchanged = [
    'how many properties in Whitefield under 1 crore?',
    'how many 3BHK apartments are available?',
    'is this overpriced?',
    'what is this property worth?',
    'why was this property flagged?',
    'show similar properties',
    'find me a 3BHK in Whitefield under 1 crore',
    '2 bhk under 80 lakhs',
  ];

  for (const message of unchanged) {
    assert.notEqual(parseMessage(message).intent, 'MARKET_ANALYTICS', `"${message}" must not become an analytics question`);
  }

  assert.equal(parseMessage('how many properties in Whitefield under 1 crore?').intent, 'PROPERTY_SEARCH');
});

test('an analytics question is refused before any listing query runs', async () => {
  const response = await ask({ message: 'Show the analytics dashboard' });

  assert.equal(response.body.data.intent, 'MARKET_ANALYTICS');
  assert.equal(response.body.data.analyticsForbidden, true);
  assert.equal(await Property.countDocuments({}), 0, 'a refused analytics question must not read the collection');
});

test('PropVal and the analytics endpoint report the same numbers', async () => {
  await seedAnalyticsListings();
  const token = await signedInAdmin();

  const asked = await askAs('How many listings are in PropIQ?', token);
  const overview = await request(app).get('/api/analytics/overview').set('Authorization', `Bearer ${token}`);

  assert.equal(asked.body.data.analytics.kpis.totalListings, overview.body.data.kpis.totalListings);
  assert.equal(asked.body.data.analytics.kpis.averageAskingPrice, overview.body.data.kpis.averageAskingPrice);
  assert.equal(asked.body.data.analytics.kpis.medianAskingPrice, overview.body.data.kpis.medianAskingPrice);
});
