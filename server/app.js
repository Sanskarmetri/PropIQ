import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { analyticsRouter } from './routes/analyticsRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { fraudRouter } from './routes/fraudRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { propertyRouter } from './routes/propertyRoutes.js';
import { propvalRouter } from './routes/propvalRoutes.js';
import { valuationRouter } from './routes/valuationRoutes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const allowedOrigins = env.clientUrl
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not allowed by CORS'));
    },
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ success: true, message: 'PropIQ API is ready' });
});
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/properties', propertyRouter);
app.use('/api/valuation', valuationRouter);
app.use('/api/fraud', fraudRouter);
app.use('/api/propval', propvalRouter);
app.use('/api/analytics', analyticsRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
