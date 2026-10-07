import { connectDatabase, disconnectDatabase, isDatabaseReady } from '../config/db.js';
import { env } from '../config/env.js';
import { HistoricalPrice } from '../models/HistoricalPrice.js';

/**
 * DEVELOPMENT SAMPLE MARKET DATA — NOT LIVE MARKET DATA.
 *
 * These figures are hand-written approximations of Indian metro ₹/sq.ft. ranges,
 * included so the valuation engine has a benchmark to work with during local
 * development. They are not sourced from a registry, a broker feed, a survey, or
 * a paid data provider, and they must not be presented as live market data.
 *
 * Each row is a locality (or city) benchmark for one property type. A row with
 * `propertyType: null` is an all-types benchmark used by the fallback hierarchy
 * when no type-specific row exists.
 *
 * `sampleSize` records how many comparable records the figure represents. It
 * drives the data-quality confidence indicator, so the numbers below are
 * deliberately modest rather than inflated.
 */
const MARKET_SAMPLE = [
  // Bengaluru
  { locality: 'Indiranagar', city: 'Bengaluru', propertyType: 'apartment', averagePricePerSqFt: 14200, sampleSize: 34 },
  { locality: 'Indiranagar', city: 'Bengaluru', propertyType: null, averagePricePerSqFt: 14650, sampleSize: 41 },
  { locality: 'Whitefield', city: 'Bengaluru', propertyType: 'villa', averagePricePerSqFt: 11800, sampleSize: 19 },
  { locality: 'Whitefield', city: 'Bengaluru', propertyType: 'apartment', averagePricePerSqFt: 9600, sampleSize: 27 },
  { locality: 'Koramangala', city: 'Bengaluru', propertyType: 'apartment', averagePricePerSqFt: 13100, sampleSize: 22 },
  { locality: 'Koramangala', city: 'Bengaluru', propertyType: null, averagePricePerSqFt: 13400, sampleSize: 26 },
  { locality: 'Sarjapur Road', city: 'Bengaluru', propertyType: 'plot', averagePricePerSqFt: 2650, sampleSize: 12 },
  { locality: 'Sarjapur Road', city: 'Bengaluru', propertyType: null, averagePricePerSqFt: 2900, sampleSize: 15 },
  { locality: null, city: 'Bengaluru', propertyType: 'apartment', averagePricePerSqFt: 10800, sampleSize: 88 },
  { locality: null, city: 'Bengaluru', propertyType: 'villa', averagePricePerSqFt: 12400, sampleSize: 24 },
  { locality: null, city: 'Bengaluru', propertyType: 'house', averagePricePerSqFt: 10200, sampleSize: 17 },
  { locality: null, city: 'Bengaluru', propertyType: 'plot', averagePricePerSqFt: 2800, sampleSize: 14 },
  { locality: null, city: 'Bengaluru', propertyType: null, averagePricePerSqFt: 10900, sampleSize: 143 },

  // Mumbai
  { locality: 'Bandra West', city: 'Mumbai', propertyType: 'apartment', averagePricePerSqFt: 31500, sampleSize: 21 },
  { locality: 'Bandra West', city: 'Mumbai', propertyType: null, averagePricePerSqFt: 30900, sampleSize: 25 },
  { locality: 'Powai', city: 'Mumbai', propertyType: 'apartment', averagePricePerSqFt: 27400, sampleSize: 18 },
  { locality: null, city: 'Mumbai', propertyType: 'apartment', averagePricePerSqFt: 26800, sampleSize: 76 },
  { locality: null, city: 'Mumbai', propertyType: 'villa', averagePricePerSqFt: 41200, sampleSize: 11 },
  { locality: null, city: 'Mumbai', propertyType: null, averagePricePerSqFt: 28100, sampleSize: 97 },

  // Pune
  { locality: 'Koregaon Park', city: 'Pune', propertyType: 'apartment', averagePricePerSqFt: 15200, sampleSize: 23 },
  { locality: 'Koregaon Park', city: 'Pune', propertyType: null, averagePricePerSqFt: 15600, sampleSize: 28 },
  { locality: 'Baner', city: 'Pune', propertyType: 'apartment', averagePricePerSqFt: 11400, sampleSize: 31 },
  { locality: null, city: 'Pune', propertyType: 'apartment', averagePricePerSqFt: 12100, sampleSize: 64 },
  { locality: null, city: 'Pune', propertyType: null, averagePricePerSqFt: 12400, sampleSize: 79 },

  // Gurugram
  { locality: 'Gurugram', city: 'Gurugram', propertyType: 'house', averagePricePerSqFt: 13900, sampleSize: 16 },
  { locality: 'Gurugram', city: 'Gurugram', propertyType: 'apartment', averagePricePerSqFt: 15200, sampleSize: 29 },
  { locality: 'Gurugram', city: 'Gurugram', propertyType: null, averagePricePerSqFt: 14900, sampleSize: 38 },
  { locality: null, city: 'Gurugram', propertyType: 'apartment', averagePricePerSqFt: 14600, sampleSize: 52 },
  { locality: null, city: 'Gurugram', propertyType: null, averagePricePerSqFt: 14400, sampleSize: 61 },
];

const MARKET_METADATA = { source: 'development-sample', period: '2025-sample' };

/**
 * Upserts one benchmark row. Re-running the seed refreshes the figures and the
 * sample sizes without duplicating rows, and never touches properties or users.
 */
const upsertBenchmark = async (row) => {
  const record = { ...row, ...MARKET_METADATA };
  const query = {
    locality: record.locality,
    city: record.city,
    propertyType: record.propertyType,
  };

  const existing = await HistoricalPrice.findOne(query);
  if (existing) {
    existing.set({
      averagePricePerSqFt: record.averagePricePerSqFt,
      sampleSize: record.sampleSize,
      source: record.source,
      period: record.period,
    });
    await existing.save();
    return { record: existing, created: false };
  }

  const created = await HistoricalPrice.create(record);
  return { record: created, created: true };
};

const run = async () => {
  if (env.nodeEnv === 'production') {
    console.error('Refusing to seed development market data while NODE_ENV is "production".');
    process.exitCode = 1;
    return;
  }

  const connected = await connectDatabase();
  if (!connected || !isDatabaseReady()) {
    console.error('Cannot seed market data: MongoDB is not connected. Check MONGODB_URI in server/.env.');
    process.exitCode = 1;
    return;
  }

  console.log('Seeding PropIQ DEVELOPMENT SAMPLE market benchmarks (not live market data):');

  for (const row of MARKET_SAMPLE) {
    const { record, created } = await upsertBenchmark(row);
    const scope = `${record.locality ?? 'All localities'}, ${record.city} · ${record.propertyType ?? 'all types'}`;
    console.log(
      `  ${created ? 'created' : 'updated'}  ₹${record.averagePricePerSqFt.toLocaleString('en-IN')}/sq.ft.  sample ${String(record.sampleSize).padStart(3)}  ${scope}`,
    );
  }

  const total = await HistoricalPrice.countDocuments();
  console.log(`\nSeed complete. ${total} benchmark rows available (development sample data only).`);
  console.log('These figures are illustrative and are not live market data.');
  await disconnectDatabase();
};

run().catch(async (error) => {
  console.error(`Seeding market data failed: ${error.message}`);
  await disconnectDatabase();
  process.exit(1);
});
