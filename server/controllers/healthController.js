import { getDatabaseStatus, isDatabaseReady } from '../config/db.js';
import { sendSuccess } from '../utils/response.js';

export const getHealth = (req, res) => {
  const database = getDatabaseStatus();
  const databaseReady = isDatabaseReady();

  return sendSuccess(res, {
    message: databaseReady
      ? 'PropIQ backend is running with a database connection'
      : 'PropIQ backend is running without a database connection',
    service: 'propiq-api',
    status: databaseReady ? 'ok' : 'degraded',
    database,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};
