import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { recordCacheHit } from '../observability/metrics';

interface Options {
  visibility: 'public' | 'private';
  /** Seconds. 0 still emits a Cache-Control header so 304s work. */
  maxAge?: number;
  /** stale-while-revalidate, in seconds. */
  swr?: number;
}

const buildCacheControl = ({ visibility, maxAge = 0, swr }: Options) => {
  const parts: string[] = [visibility];
  if (visibility === 'private' && maxAge === 0) parts.push('no-store');
  parts.push(`max-age=${maxAge}`);
  if (swr && swr > 0) parts.push(`stale-while-revalidate=${swr}`);
  return parts.join(', ');
};

const weakEtag = (body: string): string =>
  `W/"${createHash('sha1').update(body).digest('base64url').slice(0, 27)}"`;

/**
 * Express middleware factory. Wraps `res.json` so we can compute a stable
 * weak ETag from the serialised body. If `If-None-Match` matches, we drop
 * to 304 with no body. Otherwise we write the body normally.
 */
export const httpCache = (options: Options) => {
  const cacheControl = buildCacheControl(options);
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const serialised = JSON.stringify(body);
      const etag = weakEtag(serialised);
      res.setHeader('Cache-Control', cacheControl);
      res.setHeader('ETag', etag);

      const inm = req.header('if-none-match');
      if (inm && inm === etag) {
        recordCacheHit('http', req.route?.path ?? req.baseUrl ?? 'unknown');
        res.status(304).end();
        return res;
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(serialised);
      return res;
    };
    next();
  };
};
