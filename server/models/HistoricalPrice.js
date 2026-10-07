import mongoose from 'mongoose';
import { PROPERTY_TYPES } from './Property.js';

export const HISTORICAL_PRICE_SOURCES = ['development-sample'];
export const DEFAULT_HISTORICAL_PRICE_SOURCE = 'development-sample';

/**
 * A locality benchmark row: how much one square foot costs in a place, for a
 * property type (or for every property type combined when `propertyType` is null).
 *
 * Rows are DEVELOPMENT SAMPLE DATA. They are not live market data and they are
 * not derived from a registry, a broker feed, or a paid data provider.
 */
const historicalPriceSchema = new mongoose.Schema(
  {
    locality: {
      // A null locality marks a city-wide row, used by the city fallback levels.
      type: String,
      default: null,
      trim: true,
      maxlength: [120, 'Locality must be 120 characters or fewer'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [80, 'City must be 80 characters or fewer'],
    },
    propertyType: {
      type: String,
      default: null,
      enum: {
        values: [...PROPERTY_TYPES, null],
        message: `Property type must be one of: ${PROPERTY_TYPES.join(', ')}, or empty for all types`,
      },
    },
    averagePricePerSqFt: {
      type: Number,
      required: [true, 'Average price per sq.ft. is required'],
      min: [1, 'Average price per sq.ft. must be greater than 0'],
      max: [1000000, 'Average price per sq.ft. looks unrealistic'],
    },
    sampleSize: {
      type: Number,
      required: [true, 'Sample size is required'],
      min: [0, 'Sample size cannot be negative'],
      max: [1000000, 'Sample size looks unrealistic'],
      default: 0,
    },
    source: {
      type: String,
      enum: {
        values: HISTORICAL_PRICE_SOURCES,
        message: `Source must be one of: ${HISTORICAL_PRICE_SOURCES.join(', ')}`,
      },
      default: DEFAULT_HISTORICAL_PRICE_SOURCE,
    },
    period: {
      type: String,
      trim: true,
      maxlength: [40, 'Period must be 40 characters or fewer'],
      default: '2025-sample',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

historicalPriceSchema.index({ locality: 1, city: 1, propertyType: 1 }, { unique: true });
historicalPriceSchema.index({ city: 1, propertyType: 1 });

export const HistoricalPrice = mongoose.model('HistoricalPrice', historicalPriceSchema);
