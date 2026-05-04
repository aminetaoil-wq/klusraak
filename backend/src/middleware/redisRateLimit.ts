import type { NextFunction, Request, Response } from 'express';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { redis } from '../cache/redis';
import { AppError } from '../utils/AppError';
import { recordRateLimitBlock } from '../observability/metrics';

interface Options {
  windowMs: number;
  max: number;
  keyPrefix: string;
  /** Defaults to `req.user?.id ?? req.ip`. Authenticated routes get a per-user budget. */
  keyFn?: (req: Request) => string;
}

/**
 * Distributed limiter. Uses INCR + EXPIRE atomically (a single Lua script
 * inside `rate-limiter-flexible`) so multiple API replicas share counters
 * via Redis.
 *
 * Same `Options` shape as the previous in-memory limiter so call sites in
 * `app.ts` can swap one import.
 */
export const redisRateLimit = ({ windowMs, max, keyPrefix, keyFn }: Options) => {
  const limiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: `rl:${keyPrefix}`,
    points: max,
    duration: Math.ceil(windowMs / 1000),
    blockDuration: 0, // The window itself is the block.
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn ? keyFn(req) : (req.user?.id ?? req.ip ?? 'anon');
    try {
      const result = await limiter.consume(key, 1);
      // Forward useful headers when we have budget left.
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(result.remainingPoints));
      next();
    } catch (err) {
      // Two failure modes: hit the limit (RateLimiterRes) or Redis is down.
      if (err instanceof RateLimiterRes) {
        const retry = Math.ceil(err.msBeforeNext / 1000);
        res.setHeader('Retry-After', retry);
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', '0');
        recordRateLimitBlock(req.route?.path ?? req.baseUrl ?? 'unknown');
        return next(new AppError(429, 'too_many_requests', 'Too many requests, slow down.'));
      }
      // Fail-open on Redis outage. We rely on /ready already being 503.
      next();
    }
  };
};
