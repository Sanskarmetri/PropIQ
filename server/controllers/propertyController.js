import mongoose from 'mongoose';
import { isDatabaseReady } from '../config/db.js';
import { Property } from '../models/Property.js';
import { searchProperties, serializeProperty } from '../services/propertyService.js';
import { ApiError } from '../utils/ApiError.js';
import { parseListQuery, validatePropertyInput } from '../utils/propertyValidation.js';
import { sendError, sendSuccess } from '../utils/response.js';

const databaseUnavailable = (res) =>
  sendError(res, {
    httpStatus: 503,
    message: 'Property data is unavailable while MongoDB is disconnected.',
    code: 'DATABASE_UNAVAILABLE',
  });

const invalidId = () => new ApiError(400, 'The supplied property id is invalid.', 'INVALID_PROPERTY_ID');

const notFound = () => new ApiError(404, 'Property not found.', 'PROPERTY_NOT_FOUND');

const forbidden = () =>
  new ApiError(403, 'You can only manage properties that you own.', 'PROPERTY_FORBIDDEN');

const canManageProperty = (user, property) =>
  user.role === 'admin' || property.owner.toString() === user._id.toString();

export const getProperties = async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      return databaseUnavailable(res);
    }

    const query = parseListQuery(req.query);
    const { properties, pagination } = await searchProperties(query);

    return sendSuccess(res, { data: { properties, pagination } });
  } catch (error) {
    return next(error);
  }
};

export const getMyProperties = async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      return databaseUnavailable(res);
    }

    const query = parseListQuery(req.query);
    const filter = { owner: req.user._id };
    if (query.status) {
      filter.status = query.status;
    }
    const skip = (query.page - 1) * query.limit;

    const [properties, total] = await Promise.all([
      Property.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
      Property.countDocuments(filter),
    ]);

    return sendSuccess(res, {
      data: {
        properties: properties.map(serializeProperty),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.ceil(total / query.limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getPropertyById = async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      return databaseUnavailable(res);
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      throw invalidId();
    }

    const property = await Property.findById(req.params.id).lean();
    if (!property) {
      throw notFound();
    }

    return sendSuccess(res, { data: { property: serializeProperty(property) } });
  } catch (error) {
    return next(error);
  }
};

export const createProperty = async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      return databaseUnavailable(res);
    }

    const payload = validatePropertyInput(req.body);
    const property = await Property.create({ ...payload, owner: req.user._id });

    return sendSuccess(res, {
      httpStatus: 201,
      message: 'Property created successfully.',
      data: { property: serializeProperty(property) },
    });
  } catch (error) {
    return next(error);
  }
};

const findManageableProperty = async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw invalidId();
  }

  const property = await Property.findById(req.params.id);
  if (!property) {
    throw notFound();
  }
  if (!canManageProperty(req.user, property)) {
    throw forbidden();
  }

  return property;
};

export const updateProperty = async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      return databaseUnavailable(res);
    }

    const property = await findManageableProperty(req);
    const payload = validatePropertyInput(req.body, { partial: true });

    if (Object.keys(payload).length === 0) {
      throw new ApiError(400, 'Provide at least one field to update.', 'NO_UPDATES_PROVIDED');
    }

    Object.assign(property, payload);
    await property.save();

    return sendSuccess(res, {
      message: 'Property updated successfully.',
      data: { property: serializeProperty(property) },
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteProperty = async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      return databaseUnavailable(res);
    }

    const property = await findManageableProperty(req);
    await property.deleteOne();

    return sendSuccess(res, {
      message: 'Property deleted successfully.',
      data: { property: { id: property._id.toString(), title: property.title } },
    });
  } catch (error) {
    return next(error);
  }
};
