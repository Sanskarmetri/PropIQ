import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

export const USER_ROLES = ['buyer', 'seller', 'admin'];
export const SELF_ASSIGNABLE_ROLES = ['buyer', 'seller'];
export const DEFAULT_ROLE = 'buyer';
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

const SALT_ROUNDS = 10;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [80, 'Name must be 80 characters or fewer'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 160,
      match: [EMAIL_PATTERN, 'Enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: DEFAULT_ROLE,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    createdAt: this.createdAt,
  };
};

userSchema.statics.normalizeEmail = function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

export const User = mongoose.model('User', userSchema);
