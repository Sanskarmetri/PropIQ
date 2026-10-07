import mongoose from 'mongoose';
import { env } from './env.js';

const connectionStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

let connectionPromise = null;
let listenersAttached = false;

const attachConnectionListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('error', (error) => {
    console.error(`MongoDB connection error: ${error.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Database-backed routes are unavailable until the connection returns.');
  });
};

export const getDatabaseStatus = () => connectionStates[mongoose.connection.readyState] || 'unknown';

export const isDatabaseReady = () => mongoose.connection.readyState === 1;

export const connectDatabase = async () => {
  if (isDatabaseReady()) return true;
  attachConnectionListeners();

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 })
      .then(() => {
        console.log(`MongoDB connected in ${env.nodeEnv} mode`);
        return true;
      })
      .catch((error) => {
        console.error(
          `MongoDB connection failed: ${error.message} Check MONGODB_URI in server/.env and make sure MongoDB is reachable.`,
        );
        return false;
      })
      .finally(() => {
        connectionPromise = null;
      });
  }

  return connectionPromise;
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
};
