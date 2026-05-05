import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';

/**
 * Structured per-request log line. Replaces `morgan('tiny')` so we can:
 *   - include `req.id` (set by `requestId` middleware) for correlation,
 *   - emit JSON in production (Pino transport),
 *   - skip noise (health/ready/metrics).
 */
const SKIP = new Set(['/health', '/ready', '/metrics']);

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  if (SKIP.has(req.path)) return next();

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(
      {
        reqId: req.id,
        method: req.method,
        path: req.originalUrl ?? req.url,
        route: req.route?.path,
        status: res.statusCode,
        durMs: Math.round(durMs * 100) / 100,
        userId: req.user?.id,
      },
      'request',
    );
  });
  next();
};
