import mongoose from 'mongoose';

export const PROPERTY_TYPES = ['apartment', 'villa', 'house', 'plot'];
export const PROPERTY_STATUSES = ['active', 'sold', 'inactive'];
export const DEFAULT_PROPERTY_STATUS = 'active';

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Property title is required'],
      trim: true,
      minlength: [3, 'Property title must be at least 3 characters long'],
      maxlength: [160, 'Property title must be 160 characters or fewer'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Property description must be 2000 characters or fewer'],
      default: '',
    },
    locality: {
      type: String,
      required: [true, 'Locality is required'],
      trim: true,
      minlength: [2, 'Locality must be at least 2 characters long'],
      maxlength: [120, 'Locality must be 120 characters or fewer'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      minlength: [2, 'City must be at least 2 characters long'],
      maxlength: [80, 'City must be 80 characters or fewer'],
    },
    propertyType: {
      type: String,
      required: [true, 'Property type is required'],
      enum: {
        values: PROPERTY_TYPES,
        message: `Property type must be one of: ${PROPERTY_TYPES.join(', ')}`,
      },
    },
    builtUpArea: {
      type: Number,
      required: [true, 'Built-up area is required'],
      min: [1, 'Built-up area must be greater than 0'],
      max: [10000000, 'Built-up area looks unrealistic'],
    },
    bedrooms: {
      type: Number,
      min: [0, 'Bedrooms cannot be negative'],
      max: [50, 'Bedrooms looks unrealistic'],
      default: 0,
    },
    bathrooms: {
      type: Number,
      min: [0, 'Bathrooms cannot be negative'],
      max: [50, 'Bathrooms looks unrealistic'],
      default: 0,
    },
    propertyAge: {
      type: Number,
      min: [0, 'Property age cannot be negative'],
      max: [200, 'Property age looks unrealistic'],
      default: 0,
    },
    amenities: {
      type: [String],
      default: [],
      validate: {
        validator: (amenities) =>
          amenities.every((amenity) => typeof amenity === 'string' && amenity.trim().length > 0 && amenity.length <= 60),
        message: 'Each amenity must be a non-empty string of 60 characters or fewer',
      },
    },
    askingPrice: {
      type: Number,
      required: [true, 'Asking price is required'],
      min: [1, 'Asking price must be greater than 0'],
      max: [10000000000, 'Asking price looks unrealistic'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Property owner is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: PROPERTY_STATUSES,
        message: `Status must be one of: ${PROPERTY_STATUSES.join(', ')}`,
      },
      default: DEFAULT_PROPERTY_STATUS,
    },
    images: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

propertySchema.index({ locality: 1, city: 1 });
propertySchema.index({ propertyType: 1, askingPrice: 1 });
propertySchema.index({ status: 1, createdAt: -1 });
propertySchema.index({ owner: 1, createdAt: -1 });
propertySchema.index({ builtUpArea: 1 });

export const Property = mongoose.model('Property', propertySchema);
