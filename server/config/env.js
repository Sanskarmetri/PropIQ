import dotenv from 'dotenv';

dotenv.config();

const parsePort = (value) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : 5000;
};

const readRequired = (name) => {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
};

const missing = [];
const problems = [];

const mongoUri = readRequired('MONGODB_URI');
if (!mongoUri) {
  missing.push('MONGODB_URI');
} else if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
  problems.push('MONGODB_URI must start with "mongodb://" or "mongodb+srv://".');
}

const jwtSecret = readRequired('JWT_SECRET');
if (!jwtSecret) {
  missing.push('JWT_SECRET');
} else if (jwtSecret.length < 16) {
  problems.push('JWT_SECRET must be at least 16 characters long.');
}

if (missing.length > 0 || problems.length > 0) {
  const details = [
    missing.length > 0
      ? `Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`
      : '',
    ...problems,
    'Copy server/.env.example to server/.env and fill in the values before starting the backend.',
  ].filter(Boolean);

  throw new Error(`Invalid PropIQ backend configuration. ${details.join(' ')}`);
}

export const env = {
  port: parsePort(process.env.PORT),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
