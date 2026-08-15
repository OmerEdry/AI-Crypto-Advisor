import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';
import { apiRouter } from './routes';

export function createApp(): Express {
  const app = express();

  // The rate limiter keys on req.ip, which behind Render's TLS-terminating proxy is the proxy
  // itself unless one hop is trusted — every caller would share a single bucket. `1` rather
  // than `true`: trusting the whole X-Forwarded-For chain lets a client forge it and escape
  // the limit entirely.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api', apiRouter);

  // Order is load-bearing: notFound runs only when no route matched, and errorHandler must be
  // last so every throw above it — including notFound's — lands in the one formatter.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
