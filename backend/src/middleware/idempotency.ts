import type { NextFunction, Request, Response } from 'express';
import { redis } from '../cache/redis';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';

const KEY_RE = /^[\x21-\x7e]{16,128}$/;
const IN_FLIGHT = '__inflight__';

interface CachedResponse {
  status: number;
  body: unknown;
}

const buildKey = (req: Request, headerKey: string): string => {
  const userPart = req.user?.id ?? 'anon';
  // Path uses the route template (e.g. `/jobs/:id/accept`) when known so
  // distinct ids don't collide if the client recycles a key across resources.
  const route = req.baseUrl + (req.route?.path ?? req.path);
  return `idem:${req.method}:${route}:${userPart}:${headerKey}`;
};

/**
 * Idempotency-Key middleware. Apply only to POSTs whose retry semantics
 * matter (createJob, acceptJob). On replay it returns the original
 * response byte-for-byte and never re-runs the handler.
 *
 * Storage is Redis-only (24h TTL by default). The trade-off is documented
 * in /root/.claude/plans/system-design-implementation-hashed-prism.md §7.
 */
export const idempotency = () => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const headerKey = req.header('idempotency-key');
    if (!headerKey) return next();
    if (!KEY_RE.test(headerKey)) {
      return next(AppError.badRequest('Invalid Idempotency-Key (16-128 ASCII chars)'));
    }

    const key = buildKey(req, headerKey);

    // Try to claim the slot. NX guarantees exactly one writer.
    const claimed = await redis
      .set(key, IN_FLIGHT, 'EX', env.CACHE_TTL_IDEMPOTENCY, 'NX')
      .catch((err) => {
        logger.warn({ err, key }, 'idempotency claim failed; falling through');
        return null;
      });

    if (claimed !== 'OK') {
      // Either the same request is in flight, or the cached response exists.
      const stored = await redis.get(key).catch(() => null);
      if (stored === IN_FLIGHT) {
        return next(
          new AppError(409, 'idempotent_request_in_flight', 'Request with the same Idempotency-Key is still in progress.'),
        );
      }
      if (stored) {
        try {
          const cached = JSON.parse(stored) as CachedResponse;
          res.setHeader('X-Idempotent-Replay', 'true');
          res.status(cached.status).json(cached.body);
          return;
        } catch (err) {
          logger.warn({ err, key }, 'idempotency replay decode failed');
        }
      }
      // Fall through: storage is best-effort.
      return next();
    }

    // Wrap res.json so we can write back the response after the handler.
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const status = res.statusCode;
      // Only persist successful or client-error responses. 5xx must be
      // retryable, so we release the slot.
      if (status >= 500) {
        redis.del(key).catch(() => {});
      } else {
        const payload: CachedResponse = { status, body };
        redis
          .set(key, JSON.stringify(payload), 'EX', env.CACHE_TTL_IDEMPOTENCY)
          .catch((err) => logger.warn({ err, key }, 'idempotency write-back failed'));
      }
      return originalJson(body);
    };

    next();
  };
};
