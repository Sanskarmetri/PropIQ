import { isDatabaseReady } from '../config/db.js';
import {
  DEFAULT_ROLE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SELF_ASSIGNABLE_ROLES,
  User,
} from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { signToken } from '../utils/jwt.js';
import { sendSuccess } from '../utils/response.js';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const databaseUnavailable = () =>
  new ApiError(503, 'Authentication is unavailable while MongoDB is disconnected.', 'DATABASE_UNAVAILABLE');

const readText = (value) => (typeof value === 'string' ? value.trim() : '');

const resolveRole = (value) => (SELF_ASSIGNABLE_ROLES.includes(value) ? value : DEFAULT_ROLE);

const validateEmail = (value) => {
  const email = User.normalizeEmail(value);
  if (!email) {
    throw new ApiError(400, 'Email address is required.', 'EMAIL_REQUIRED');
  }
  if (email.length > 160 || !EMAIL_PATTERN.test(email)) {
    throw new ApiError(400, 'Enter a valid email address.', 'INVALID_EMAIL');
  }
  return email;
};

const validatePassword = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(400, 'Password is required.', 'PASSWORD_REQUIRED');
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    throw new ApiError(
      400,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
      'PASSWORD_TOO_SHORT',
    );
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    throw new ApiError(
      400,
      `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`,
      'PASSWORD_TOO_LONG',
    );
  }
  return value;
};

const validateName = (value) => {
  const name = readText(value);
  if (name.length < 2) {
    throw new ApiError(400, 'Name must be at least 2 characters long.', 'INVALID_NAME');
  }
  if (name.length > 80) {
    throw new ApiError(400, 'Name must be 80 characters or fewer.', 'INVALID_NAME');
  }
  return name;
};

const invalidCredentials = () => new ApiError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');

export const register = async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      throw databaseUnavailable();
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const name = validateName(body.name);
    const email = validateEmail(body.email);
    const password = validatePassword(body.password);
    const role = resolveRole(readText(body.role).toLowerCase());

    const existingUser = await User.findOne({ email }).select('_id');
    if (existingUser) {
      throw new ApiError(409, 'An account with that email address already exists.', 'EMAIL_TAKEN');
    }

    const user = await User.create({ name, email, password, role });

    return sendSuccess(res, {
      httpStatus: 201,
      message: 'Account created successfully.',
      data: { user: user.toSafeObject(), token: signToken(user) },
    });
  } catch (error) {
    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      throw databaseUnavailable();
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const email = validateEmail(body.email);
    const password = body.password;

    if (typeof password !== 'string' || password.length === 0) {
      throw invalidCredentials();
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      throw invalidCredentials();
    }

    return sendSuccess(res, {
      message: 'Signed in successfully.',
      data: { user: user.toSafeObject(), token: signToken(user) },
    });
  } catch (error) {
    return next(error);
  }
};

export const getCurrentUser = (req, res) =>
  sendSuccess(res, {
    message: 'Authenticated user retrieved.',
    data: { user: req.user.toSafeObject() },
  });
