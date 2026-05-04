import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import type { NextFunction, Request, Response } from 'express';

// One registry per process. Using the default would couple unrelated tests.
export const registry = new Registry();
collectDefaultMetrics({ register: registry });

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

const httpTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Cache hits, by layer and key prefix',
  labelNames: ['layer', 'key_prefix'] as const,
  registers: [registry],
});

const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Cache misses, by layer and key prefix',
  labelNames: ['layer', 'key_prefix'] as const,
  registers: [registry],
});

const queueJobs = new Counter({
  name: 'queue_jobs_total',
  help: 'Background jobs processed, by queue and result',
  labelNames: ['queue', 'result'] as const,
  registers: [registry],
});

const rateLimitBlocks = new Counter({
  name: 'rate_limit_blocks_total',
  help: 'Requests blocked by rate limit, by route',
  labelNames: ['route'] as const,
  registers: [registry],
});

export const recordCacheHit = (
  layer: 'redis' | 'lru' | 'http',
  keyPrefix: string,
): void => {
  cacheHits.inc({ layer, key_prefix: keyPrefix });
};

export const recordCacheMiss = (
  layer: 'redis' | 'lru' | 'http',
  keyPrefix: string,
): void => {
  cacheMisses.inc({ layer, key_prefix: keyPrefix });
};

export const recordQueueJob = (queue: string, result: 'completed' | 'failed'): void => {
  queueJobs.inc({ queue, result });
};

export const recordRateLimitBlock = (route: string): void => {
  rateLimitBlocks.inc({ route });
};

/**
 * Express middleware that observes each request's duration. We label by
 * `req.route?.path` (template, e.g. `/jobs/:id`) — never `req.path` — so
 * label cardinality stays bounded.
 */
export const httpMetricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path ?? req.baseUrl ?? 'unknown';
    const labels = { method: req.method, route, status: String(res.statusCode) };
    end(labels);
    httpTotal.inc(labels);
  });
  next();
};

export const metricsHandler = async (_req: Request, res: Response): Promise<void> => {
  res.setHeader('Content-Type', registry.contentType);
  res.send(await registry.metrics());
};
