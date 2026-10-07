import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { app, connectDatabase, disconnectDatabase, HistoricalPrice, mongoServer, Property, User } from './support/app.js';

// Imported dynamically on purpose: `support/app.js` sets the test environment
// after a top-level await, so statically importing anything that reads
// `config/env.js` here would evaluate it before the test env exists.
const { AGE_BANDS, VALUATION_LIMITS } = await import('../config/valuationConfig.js');
const {
  calculateValuation,
  resolveAgeAdjustment,
  resolveAmenities,
  valueProperty,
  valueStoredProperty,
} = await import('../services/valuationService.js');

const benchmarkRow = (overrides = {}) => ({
  locality: 'Indiranagar',
  city: 'Bengaluru',
  propertyType: 'apartment',
  averagePricePerSqFt: 14000,
  sampleSize: 20,
  source: 'development-sample',
  period: '2025-sample',
  ...overrides,
});

const propertyInput = (overrides = {}) => ({
  locality: 'Indiranagar',
  city: 'Bengaluru',
  propertyType: 'apartment',
  builtUpArea: 2000,
  bedrooms: 3,
  bathrooms: 3,
  propertyAge: 0,
  amenities: [],
  ...overrides,
});

const postValuation = (body) => request(app).post('/api/valuation').send(body);

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
/* Benchmark lookup and fallback hierarchy                                     */
/* -------------------------------------------------------------------------- */

test('an exact locality and property type benchmark is used first', async () => {
  await HistoricalPrice.create([
    benchmarkRow({ propertyType: null, averagePricePerSqFt: 9000, sampleSize: 5 }),
    benchmarkRow({ locality: null, city: 'Bengaluru', propertyType: 'apartment', averagePricePerSqFt: 8000, sampleSize: 5 }),
    benchmarkRow({ propertyType: 'apartment', averagePricePerSqFt: 14000, sampleSize: 20 }),
  ]);

  const result = await valueProperty(propertyInput());

  assert.equal(result.marketData.averagePricePerSqFt, 14000);
  assert.equal(result.marketData.matchedLevel, 'locality-type');
  assert.equal(result.marketData.sampleSize, 20);
  assert.equal(result.confidence.factors.propertyTypeSpecific, true);
});

test('benchmark lookup is case insensitive for locality and city', async () => {
  await HistoricalPrice.create(benchmarkRow({ locality: 'indiranagar', city: 'bengaluru' }));

  const result = await valueProperty(propertyInput({ locality: 'Indiranagar', city: 'Bengaluru' }));

  assert.equal(result.marketData.averagePricePerSqFt, 14000);
});

test('the locality and city fallback is used when no type benchmark exists', async () => {
  await HistoricalPrice.create([
    benchmarkRow({ propertyType: null, averagePricePerSqFt: 12000, sampleSize: 12 }),
    benchmarkRow({ locality: null, city: 'Bengaluru', propertyType: 'apartment', averagePricePerSqFt: 8000 }),
  ]);

  const result = await valueProperty(propertyInput());

  assert.equal(result.marketData.averagePricePerSqFt, 12000);
  assert.equal(result.marketData.matchedLevel, 'locality');
  assert.equal(result.confidence.factors.propertyTypeSpecific, false);
  assert.equal(result.confidence.factors.benchmarkMatch, 'locality-wide benchmark across all property types');
});

test('the city and property type fallback is used when the locality is unknown', async () => {
  await HistoricalPrice.create([
    benchmarkRow({ locality: null, city: 'Bengaluru', propertyType: 'apartment', averagePricePerSqFt: 10500, sampleSize: 30 }),
    benchmarkRow({ locality: null, city: 'Bengaluru', propertyType: null, averagePricePerSqFt: 9000 }),
  ]);

  const result = await valueProperty(propertyInput({ locality: 'Jayanagar' }));

  assert.equal(result.marketData.averagePricePerSqFt, 10500);
  assert.equal(result.marketData.matchedLevel, 'city-type');
});

test('the city wide fallback is the last resort before giving up', async () => {
  await HistoricalPrice.create(
    benchmarkRow({ locality: null, city: 'Bengaluru', propertyType: null, averagePricePerSqFt: 9200, sampleSize: 60 }),
  );

  const result = await valueProperty(propertyInput({ locality: 'Jayanagar' }));

  assert.equal(result.marketData.averagePricePerSqFt, 9200);
  assert.equal(result.marketData.matchedLevel, 'city');
});

test('an unknown city reports insufficient market data instead of guessing', async () => {
  const attempt = await postValuation(propertyInput({ locality: 'Nowhere', city: 'Atlantis' }));

  assert.equal(attempt.status, 422);
  assert.equal(attempt.body.success, false);
  assert.equal(attempt.body.code, 'INSUFFICIENT_MARKET_DATA');
  assert.equal(attempt.body.data, undefined);
  assert.deepEqual(attempt.body.details.searched, [
    { locality: 'Nowhere', city: 'Atlantis', propertyType: 'apartment' },
  ]);
  assert.equal(attempt.body.details.fallbackAttempts.length, 4);
  assert.ok(attempt.body.details.fallbackAttempts.every((attempted) => attempted.matched === false));
  assert.equal(attempt.body.stack, undefined);
});

test('a property type with no type-specific benchmark never borrows another type rate', async () => {
  await HistoricalPrice.create(benchmarkRow({ propertyType: 'villa', averagePricePerSqFt: 20000 }));
  await HistoricalPrice.create(benchmarkRow({ locality: null, city: 'Bengaluru', propertyType: 'apartment', averagePricePerSqFt: 10500 }));
  await HistoricalPrice.create(benchmarkRow({ locality: null, city: 'Bengaluru', propertyType: null, averagePricePerSqFt: 9000 }));

  const response = await postValuation(propertyInput({ propertyType: 'house' }));

  assert.equal(response.status, 200, 'the city-wide all-types row is a valid last resort');
  assert.equal(response.body.data.valuation.marketData.averagePricePerSqFt, 9000, 'not the villa or apartment rate');
  assert.equal(response.body.data.valuation.marketData.propertyType, null);
  assert.equal(response.body.data.valuation.confidence.factors.propertyTypeSpecific, false);
});

test('no benchmark of any kind for the city is refused rather than guessed', async () => {
  await HistoricalPrice.create(benchmarkRow({ propertyType: 'villa', averagePricePerSqFt: 20000 }));
  await HistoricalPrice.create(benchmarkRow({ locality: null, city: 'Mumbai', propertyType: 'apartment', averagePricePerSqFt: 30000 }));

  const attempt = await postValuation(propertyInput({ propertyType: 'house' }));

  assert.equal(attempt.status, 422);
  assert.equal(attempt.body.code, 'INSUFFICIENT_MARKET_DATA');
});

/* -------------------------------------------------------------------------- */
/* Base valuation                                                              */
/* -------------------------------------------------------------------------- */

test('base value is the benchmark price per sq.ft. times the built-up area', () => {
  const valuation = calculateValuation({
    property: propertyInput({ builtUpArea: 2000, amenities: [], propertyAge: 0 }),
    benchmark: { averagePricePerSqFt: 14000, propertyType: 'apartment', matchedLevel: 'locality-type', locality: 'Indiranagar', city: 'Bengaluru', sampleSize: 20 },
    fallbackScore: 40,
  });

  assert.equal(valuation.baseValue, 28000000);
  assert.equal(valuation.amenityAdjustment.total, 0);
  assert.equal(valuation.ageAdjustment.percentage, 0);
  assert.equal(valuation.estimatedValue, 28000000);
  assert.equal(valuation.estimatedPricePerSqFt, 14000);
  assert.equal(valuation.benchmarkPricePerSqFt, 14000);
});

test('estimated price per sq.ft. reflects the adjustments', async () => {
  await HistoricalPrice.create(benchmarkRow({ averagePricePerSqFt: 10000, sampleSize: 20 }));

  const result = await valueProperty(propertyInput({ builtUpArea: 1000, amenities: ['Covered parking'], propertyAge: 20 }));

  const expectedFactor = (1 + 0.03) * (1 - 0.1);
  assert.equal(result.baseValue, 10000000);
  assert.equal(result.estimatedValue, Math.round(10000000 * expectedFactor));
  assert.equal(result.estimatedPricePerSqFt, Math.round(result.estimatedValue / 1000));
});

/* -------------------------------------------------------------------------- */
/* Amenity adjustment                                                          */
/* -------------------------------------------------------------------------- */

test('recognised amenities add a weighted adjustment and are reported individually', () => {
  const amenities = resolveAmenities(['Private balcony', 'Covered parking']);

  assert.equal(amenities.recognized.length, 2);
  assert.equal(amenities.total, 0.055);
  assert.deepEqual(amenities.unrecognized, []);
  assert.deepEqual(
    amenities.recognized.map((rule) => rule.id).sort(),
    ['balcony', 'parking'],
  );
});

test('equivalent amenities are counted once, not twice', () => {
  const amenities = resolveAmenities(['Covered parking', 'Reserved parking', 'Two-car garage']);

  assert.equal(amenities.recognized.length, 1, 'all three map to the parking group');
  assert.equal(amenities.recognized[0].id, 'parking');
  assert.equal(amenities.total, 0.03);
  assert.equal(amenities.recognized[0].matched.length, 3, 'every source label is reported');
});

test('the longest matching amenity alias wins', () => {
  const amenities = resolveAmenities(['Power backup']);

  assert.equal(amenities.recognized.length, 1);
  assert.equal(amenities.recognized[0].id, 'powerBackup');
  assert.equal(amenities.recognized[0].matched[0], 'Power backup');
});

test('unknown amenities are reported but never fail the valuation', async () => {
  await HistoricalPrice.create(benchmarkRow({ averagePricePerSqFt: 10000 }));

  const response = await postValuation(
    propertyInput({ builtUpArea: 1000, amenities: ['Zipline to work', 'Meditation dome'] }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.data.valuation.amenityAdjustment.total, 0);
  assert.deepEqual(response.body.data.valuation.amenityAdjustment.unrecognized, [
    'Zipline to work',
    'Meditation dome',
  ]);
  assert.equal(response.body.data.valuation.estimatedValue, 10000000);
});

test('the amenity adjustment is capped so amenities cannot dominate the estimate', () => {
  const amenities = resolveAmenities([
    'Private garden',
    'Swimming pool',
    'Sea view',
    'Smart home',
    'Gym',
    'Concierge',
    'Clubhouse',
    'Solar panels',
    'Power backup',
    'Lift',
    'East facing',
    'Clear title',
    'Cycling room',
    'Pet friendly',
    'Home office',
    'Servant quarters',
  ]);

  assert.ok(amenities.rawTotal > VALUATION_LIMITS.maxAmenityAdjustment, `raw total was ${amenities.rawTotal}`);
  assert.equal(amenities.total, VALUATION_LIMITS.maxAmenityAdjustment);
  assert.equal(amenities.capped, true);
  assert.equal(amenities.recognized.length, 16);
});

/* -------------------------------------------------------------------------- */
/* Property-age adjustment                                                     */
/* -------------------------------------------------------------------------- */

test('property age uses transparent bands with no adjustment for a new property', () => {
  assert.deepEqual(resolveAgeAdjustment(0).percentage, 0);
  assert.deepEqual(resolveAgeAdjustment(1).percentage, 0);
  assert.deepEqual(resolveAgeAdjustment(4).percentage, -0.01);
  assert.deepEqual(resolveAgeAdjustment(8).percentage, -0.03);
  assert.deepEqual(resolveAgeAdjustment(12).percentage, -0.06);
  assert.deepEqual(resolveAgeAdjustment(20).percentage, -0.1);
  assert.deepEqual(resolveAgeAdjustment(40).percentage, -0.15);
});

test('every configured age band is reachable and ordered', () => {
  assert.equal(AGE_BANDS[0].maxAge, 1);
  assert.ok(AGE_BANDS.every((band, index) => index === 0 || band.maxAge > AGE_BANDS[index - 1].maxAge));
  assert.ok(AGE_BANDS.every((band) => band.percentage <= 0));
});

test('the age adjustment cannot produce a zero or negative value', async () => {
  await HistoricalPrice.create(benchmarkRow({ averagePricePerSqFt: 10000 }));

  const response = await postValuation(propertyInput({ builtUpArea: 1000, propertyAge: 150 }));

  assert.equal(response.status, 200);
  assert.equal(response.body.data.valuation.ageAdjustment.percentage, -0.15);
  assert.ok(response.body.data.valuation.estimatedValue > 0);
  assert.equal(response.body.data.valuation.estimatedValue, 8500000);
});

test('a new build is not depreciated', async () => {
  await HistoricalPrice.create(benchmarkRow({ averagePricePerSqFt: 10000 }));

  const response = await postValuation(propertyInput({ builtUpArea: 1500, propertyAge: 1 }));

  assert.equal(response.body.data.valuation.estimatedValue, 15000000);
  assert.equal(response.body.data.valuation.ageAdjustment.percentage, 0);
});

/* -------------------------------------------------------------------------- */
/* Combined valuation                                                          */
/* -------------------------------------------------------------------------- */

test('base value, amenity adjustment, and age adjustment combine in one result', async () => {
  await HistoricalPrice.create(benchmarkRow({ averagePricePerSqFt: 10000, sampleSize: 20 }));

  const response = await postValuation(
    propertyInput({ builtUpArea: 2000, amenities: ['Covered parking', 'Private garden'], propertyAge: 12 }),
  );

  const valuation = response.body.data.valuation;
  const expectedAmenity = 0.07;
  const expectedAge = -0.06;

  assert.equal(response.status, 200);
  assert.equal(valuation.baseValue, 20000000);
  assert.equal(valuation.amenityAdjustment.total, expectedAmenity);
  assert.equal(valuation.ageAdjustment.percentage, expectedAge);
  assert.equal(valuation.estimatedValue, Math.round(20000000 * (1 + expectedAmenity) * (1 + expectedAge)));
  assert.equal(valuation.estimatedPricePerSqFt, Math.round(valuation.estimatedValue / 2000));
});

test('the result exposes a generated explanation built from the valuation', async () => {
  await HistoricalPrice.create(benchmarkRow({ averagePricePerSqFt: 10000, sampleSize: 18 }));

  const response = await postValuation(
    propertyInput({ locality: 'Indiranagar', builtUpArea: 2000, amenities: ['Covered parking'], propertyAge: 7 }),
  );

  const { explanation, marketData, property } = response.body.data.valuation;

  assert.ok(explanation.includes('18 sample comparable records'), explanation);
  assert.ok(explanation.includes('₹10,000'), explanation);
  assert.ok(explanation.includes('2,000 sq.ft.'), explanation);
  assert.ok(explanation.includes('₹2,00,00,000'), explanation);
  assert.ok(explanation.includes('+3%'), explanation);
  assert.ok(explanation.includes('−3%'), explanation);
  assert.ok(explanation.includes('medium data-quality confidence'), explanation);
  assert.ok(explanation.includes(marketData.locality), explanation);
  assert.ok(explanation.includes(property.locality), explanation);
});

test('a city-wide benchmark explains itself without a null locality', async () => {
  await HistoricalPrice.create(
    benchmarkRow({ locality: null, city: 'Bengaluru', propertyType: null, averagePricePerSqFt: 9000, sampleSize: 45 }),
  );

  const response = await postValuation(propertyInput({ locality: 'Jayanagar' }));
  const { explanation } = response.body.data.valuation;

  assert.equal(response.status, 200);
  assert.ok(explanation.includes('Bengaluru (all localities)'), explanation);
  assert.ok(!explanation.includes('null'), explanation);
});

test('the explanation adapts to the property instead of being a fixed string', async () => {
  await HistoricalPrice.create(benchmarkRow({ averagePricePerSqFt: 10000, sampleSize: 4 }));

  const withAmenities = await postValuation(propertyInput({ builtUpArea: 1000, amenities: ['Gym'], propertyAge: 1 }));
  const withoutAmenities = await postValuation(propertyInput({ builtUpArea: 1000, propertyAge: 1 }));

  assert.notEqual(
    withAmenities.body.data.valuation.explanation,
    withoutAmenities.body.data.valuation.explanation,
  );
  assert.ok(withoutAmenities.body.data.valuation.explanation.includes('No configured amenities were recognised'));
  assert.ok(withAmenities.body.data.valuation.explanation.includes('Recognised amenities contributed +1.5%'));
});

/* -------------------------------------------------------------------------- */
/* Confidence                                                                  */
/* -------------------------------------------------------------------------- */

test('confidence is a bounded data-quality indicator, not a probability', async () => {
  await HistoricalPrice.create(benchmarkRow({ sampleSize: 60, averagePricePerSqFt: 10000 }));

  const response = await postValuation(propertyInput());
  const { confidence } = response.body.data.valuation;

  assert.ok(['low', 'medium', 'high'].includes(confidence.level));
  assert.ok(confidence.score >= 0 && confidence.score <= 100);
  assert.equal(confidence.label, 'Data-quality confidence');
  assert.ok(confidence.description.length > 0);
  assert.ok(confidence.basis.includes('not a statistical confidence interval'));
});

test('a broader fallback and a smaller sample lower the confidence level', async () => {
  await HistoricalPrice.create(
    benchmarkRow({ locality: null, city: 'Bengaluru', propertyType: null, averagePricePerSqFt: 9000, sampleSize: 3 }),
  );

  const response = await postValuation(propertyInput({ locality: 'Jayanagar' }));
  const { confidence } = response.body.data.valuation;

  assert.equal(confidence.factors.benchmarkMatch, 'city-wide benchmark across all property types');
  assert.equal(confidence.factors.sampleSize, 3);
  assert.ok(confidence.score < 50, `expected a low score, received ${confidence.score}`);
  assert.equal(confidence.level, 'low');
});

test('a large type-specific sample reaches the highest confidence level', async () => {
  await HistoricalPrice.create(benchmarkRow({ sampleSize: 80, averagePricePerSqFt: 10000 }));

  const response = await postValuation(propertyInput());
  const { confidence } = response.body.data.valuation;

  assert.equal(confidence.score, 80);
  assert.equal(confidence.level, 'high');
});

/* -------------------------------------------------------------------------- */
/* API contract                                                                */
/* -------------------------------------------------------------------------- */

test('POST /api/valuation returns a structured valuation without authentication', async () => {
  await HistoricalPrice.create(benchmarkRow({ averagePricePerSqFt: 12000, sampleSize: 30 }));

  const response = await postValuation(
    propertyInput({ builtUpArea: 1800, amenities: 'Covered parking, Private garden', propertyAge: 5 }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  const { valuation } = response.body.data;

  for (const key of [
    'estimatedValue',
    'estimatedPricePerSqFt',
    'benchmarkPricePerSqFt',
    'baseValue',
    'amenityAdjustment',
    'ageAdjustment',
    'confidence',
    'marketData',
    'explanation',
  ]) {
    assert.ok(key in valuation, `expected ${key} in the valuation payload`);
  }

  assert.equal(valuation.source, 'inline');
  assert.equal(valuation.benchmarkPricePerSqFt, 12000);
  assert.equal(valuation.baseValue, 21600000);
  assert.equal(valuation.disclaimer.includes('not live market data'), true);
  assert.equal(response.body.stack, undefined);
});

test('POST /api/valuation rejects a request with no valuation input', async () => {
  const response = await postValuation({});

  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'VALUATION_INPUT_REQUIRED');
});

test('POST /api/valuation rejects invalid area, age, and property type with field errors', async () => {
  const negativeArea = await postValuation(propertyInput({ builtUpArea: -100 }));
  assert.equal(negativeArea.status, 400);
  assert.equal(negativeArea.body.code, 'VALUATION_VALIDATION_FAILED');
  assert.equal(negativeArea.body.details.builtUpArea, 'Built-up area must be greater than 0');
  assert.equal(negativeArea.body.stack, undefined);

  const textArea = await postValuation(propertyInput({ builtUpArea: 'big' }));
  assert.equal(textArea.status, 400);
  assert.equal(textArea.body.details.builtUpArea, 'Built-up area must be a number');

  const zeroArea = await postValuation(propertyInput({ builtUpArea: 0 }));
  assert.equal(zeroArea.status, 400);
  assert.equal(zeroArea.body.details.builtUpArea, 'Built-up area must be greater than 0');

  const hugeArea = await postValuation(propertyInput({ builtUpArea: 50000000 }));
  assert.equal(hugeArea.status, 400);
  assert.equal(hugeArea.body.details.builtUpArea, 'Built-up area looks unrealistic');

  const negativeAge = await postValuation(propertyInput({ propertyAge: -5 }));
  assert.equal(negativeAge.status, 400);
  assert.equal(negativeAge.body.details.propertyAge, 'Property age must be 0 or more');

  const fractionalAge = await postValuation(propertyInput({ propertyAge: 4.5 }));
  assert.equal(fractionalAge.status, 400);
  assert.equal(fractionalAge.body.details.propertyAge, 'Property age must be a whole number');

  const unrealisticAge = await postValuation(propertyInput({ propertyAge: 900 }));
  assert.equal(unrealisticAge.status, 400);
  assert.equal(unrealisticAge.body.details.propertyAge, 'Property age looks unrealistic');

  const badType = await postValuation(propertyInput({ propertyType: 'castle' }));
  assert.equal(badType.status, 400);
  assert.ok(badType.body.details.propertyType.startsWith('Property type must be one of'));
});

test('POST /api/valuation reports every missing field at once', async () => {
  const response = await postValuation({ locality: 'Indiranagar' });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'VALUATION_VALIDATION_FAILED');
  assert.deepEqual(Object.keys(response.body.details).sort(), ['builtUpArea', 'city', 'propertyType']);
});

test('POST /api/valuation rejects amenities that are not short labels', async () => {
  const tooMany = await postValuation(propertyInput({ amenities: Array.from({ length: 21 }, (_, index) => `A${index}`) }));
  assert.equal(tooMany.status, 400);
  assert.ok(tooMany.body.details.amenities.startsWith('Use at most'));

  const tooLong = await postValuation(propertyInput({ amenities: ['x'.repeat(61)] }));
  assert.equal(tooLong.status, 400);
  assert.ok(tooLong.body.details.amenities.startsWith('Each amenity must be'));

  const notAList = await postValuation(propertyInput({ amenities: { 0: 'Gym' } }));
  assert.equal(notAList.status, 400);
  assert.equal(notAList.body.details.amenities, 'Amenities must be a list of short labels');
});

test('POST /api/valuation rejects a malformed body without a stack trace', async () => {
  const response = await request(app)
    .post('/api/valuation')
    .set('Content-Type', 'application/json')
    .send('{"locality": "Indiranagar",,,}');

  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'INVALID_JSON');
  assert.equal(response.body.stack, undefined);
});

/* -------------------------------------------------------------------------- */
/* Stored property valuation                                                   */
/* -------------------------------------------------------------------------- */

test('POST /api/valuation values a stored property from its saved details', async () => {
  await HistoricalPrice.create(benchmarkRow({ averagePricePerSqFt: 14000, sampleSize: 30 }));
  const owner = await User.create({
    name: 'Diya Menon',
    email: 'seller@example.com',
    password: 'Str0ng-PropIQ-Password',
    role: 'seller',
  });
  const property = await Property.create({
    title: 'Sunlit Courtyard Residence',
    locality: 'Indiranagar',
    city: 'Bengaluru',
    propertyType: 'apartment',
    builtUpArea: 2000,
    bedrooms: 3,
    bathrooms: 2,
    propertyAge: 8,
    amenities: ['Covered parking'],
    askingPrice: 26000000,
    owner: owner._id,
  });

  const response = await postValuation({ propertyId: property._id.toString() });
  const { valuation } = response.body.data;

  assert.equal(response.status, 200);
  assert.equal(valuation.source, 'property');
  assert.equal(valuation.property.id, property._id.toString());
  assert.equal(valuation.property.title, 'Sunlit Courtyard Residence');
  assert.equal(valuation.property.askingPrice, 26000000);
  assert.equal(valuation.baseValue, 28000000);
  assert.equal(valuation.amenityAdjustment.total, 0.03);
  assert.equal(valuation.ageAdjustment.percentage, -0.03);
});

test('valuing a stored property is recalculated and never written back to the model', async () => {
  await HistoricalPrice.create(benchmarkRow({ averagePricePerSqFt: 10000, sampleSize: 20 }));
  const owner = await User.create({
    name: 'Diya Menon',
    email: 'seller@example.com',
    password: 'Str0ng-PropIQ-Password',
    role: 'seller',
  });
  const property = await Property.create({
    title: 'Unchanged Listing',
    locality: 'Indiranagar',
    city: 'Bengaluru',
    propertyType: 'apartment',
    builtUpArea: 1000,
    askingPrice: 12000000,
    owner: owner._id,
  });

  const first = await postValuation({ propertyId: property._id.toString() });
  assert.equal(first.body.data.valuation.estimatedValue, 10000000);

  const stored = await Property.findById(property._id).lean();
  assert.equal(stored.estimatedValue, undefined, 'no valuation is persisted on the property');
  assert.equal(stored.estimatedPricePerSqFt, undefined);

  await HistoricalPrice.updateOne({}, { $set: { averagePricePerSqFt: 12000 } });
  const second = await postValuation({ propertyId: property._id.toString() });
  assert.equal(second.body.data.valuation.estimatedValue, 12000000, 'a new benchmark recalculates the estimate');
});

test('valuing a stored property handles an invalid, unknown, or uncovered property', async () => {
  const invalid = await postValuation({ propertyId: 'not-an-id' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.code, 'VALUATION_VALIDATION_FAILED');
  assert.equal(invalid.body.details.propertyId, 'Property id is invalid');

  const unknown = await postValuation({ propertyId: new mongoose.Types.ObjectId().toString() });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.code, 'PROPERTY_NOT_FOUND');
  assert.equal(unknown.body.stack, undefined);

  const owner = await User.create({
    name: 'Diya Menon',
    email: 'seller@example.com',
    password: 'Str0ng-PropIQ-Password',
    role: 'seller',
  });
  const uncovered = await Property.create({
    title: 'Far Away Home',
    locality: 'Nowhere',
    city: 'Atlantis',
    propertyType: 'apartment',
    builtUpArea: 1000,
    askingPrice: 1000000,
    owner: owner._id,
  });

  const insufficient = await postValuation({ propertyId: uncovered._id.toString() });
  assert.equal(insufficient.status, 422);
  assert.equal(insufficient.body.code, 'INSUFFICIENT_MARKET_DATA');
});

test('the service exposes a property id entry point used by the controller', async () => {
  await HistoricalPrice.create(benchmarkRow({ averagePricePerSqFt: 10000 }));
  const owner = await User.create({
    name: 'Diya Menon',
    email: 'seller@example.com',
    password: 'Str0ng-PropIQ-Password',
    role: 'seller',
  });
  const property = await Property.create({
    title: 'Direct Service Listing',
    locality: 'Indiranagar',
    city: 'Bengaluru',
    propertyType: 'apartment',
    builtUpArea: 1200,
    askingPrice: 12000000,
    owner: owner._id,
  });

  const result = await valueStoredProperty(property._id.toString());

  assert.equal(result.source, 'property');
  assert.equal(result.estimatedValue, 12000000);
  assert.equal(typeof result.explanation, 'string');
});

test('calculateValuation returns null without a benchmark so no silent estimate is produced', () => {
  const valuation = calculateValuation({ property: propertyInput(), benchmark: null });

  assert.equal(valuation, null);
});
