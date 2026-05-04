import express, { type Application } from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { requestId } from './middleware/requestId';
import { requestLogger } from './middleware/requestLogger';
import { redisRateLimit } from './middleware/redisRateLimit';
import { httpMetricsMiddleware, metricsHandler } from './observability/metrics';
import { liveness, readiness } from './observability/health';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { categoriesRouter } from './modules/categories/categories.routes';
import { jobsRouter } from './modules/jobs/jobs.routes';

export const createApp = (): Application => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Honour X-Forwarded-For from the reverse proxy.
  app.use(requestId);
  app.use(helmet());
  // gzip JSON responses; threshold avoids compressing tiny health bodies.
  app.use(compression({ threshold: 1024 }));
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: false,
      allowedHeaders: ['Content-Type', 'Authorization', 'If-None-Match', 'Idempotency-Key', 'X-Request-ID'],
      exposedHeaders: ['ETag', 'X-Request-ID', 'Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(httpMetricsMiddleware);
  app.use(requestLogger);

  // Ops endpoints — kept off /api so they aren't subject to the API-wide
  // rate limiter and aren't logged by requestLogger.
  app.get('/health', liveness);
  app.get('/ready', readiness);
  app.get('/metrics', metricsHandler);

  // Soft API-wide ceiling. Catches runaway clients without hampering normal use.
  app.use('/api', redisRateLimit({ windowMs: 60_000, max: 600, keyPrefix: 'api' }));

  // Auth surface is the cheapest target for credential stuffing — tighter cap.
  app.use(
    '/api/auth',
    redisRateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      keyPrefix: 'auth',
      keyFn: (req) => req.ip ?? 'anon',
    }),
    authRouter,
  );

  app.use('/api/users', usersRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/jobs', jobsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
