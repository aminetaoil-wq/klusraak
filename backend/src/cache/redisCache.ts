import { redis } from './redis';
import { logger } from '../config/logger';
import { recordCacheHit, recordCacheMiss } from '../observability/metrics';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const keyPrefix = (key: string) => key.split(':', 1)[0] ?? 'unknown';

/**
 * Read-through cache with stampede protection.
 *
 * On miss, exactly one caller wins a Redis lock (`SET key:lock NX PX 5000`)
 * and runs `loader`. Losers poll the value key for up to 2 s, then fall
 * back to the loader themselves — better to do double work than to error.
 */
export async function getOrSet<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      recordCacheHit('redis', keyPrefix(key));
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    logger.warn({ err, key }, 'redis get failed; falling through to loader');
    return loader();
  }

  recordCacheMiss('redis', keyPrefix(key));

  const lockKey = `${key}:lock`;
  let won = false;
  try {
    const ok = await redis.set(lockKey, '1', 'PX', 5000, 'NX');
    won = ok === 'OK';
  } catch (err) {
    logger.warn({ err, key }, 'redis lock failed; loading directly');
    return loader();
  }

  if (!won) {
    // Wait briefly for the winner to populate the key.
    for (let i = 0; i < 20; i += 1) {
      await sleep(100);
      const v = await redis.get(key).catch(() => null);
      if (v !== null) return JSON.parse(v) as T;
    }
    // Fall through: better to double-load than to fail the request.
    return loader();
  }

  try {
    const value = await loader();
    await redis.set(key, JSON.stringify(value), 'EX', ttlSec).catch((err) => {
      logger.warn({ err, key }, 'redis set failed; value not cached');
    });
    return value;
  } finally {
    await redis.del(lockKey).catch(() => {});
  }
}

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await redis.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch (err) {
    logger.warn({ err, key }, 'cacheGet failed');
    return null;
  }
};

export const cacheSet = async <T>(key: string, value: T, ttlSec: number): Promise<void> => {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSec);
  } catch (err) {
    logger.warn({ err, key }, 'cacheSet failed');
  }
};

export const del = async (keys: string | string[]): Promise<void> => {
  const arr = Array.isArray(keys) ? keys : [keys];
  if (arr.length === 0) return;
  try {
    await redis.unlink(...arr);
  } catch (err) {
    logger.warn({ err, keys: arr }, 'cache del failed');
  }
};

/**
 * SCAN-based wildcard delete. Non-blocking on the server (vs KEYS), uses
 * UNLINK for async free. Safe to call with hundreds of thousands of keys.
 */
export const delPattern = async (pattern: string): Promise<number> => {
  let cursor = '0';
  let removed = 0;
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
    cursor = next;
    if (batch.length > 0) {
      try {
        removed += await redis.unlink(...batch);
      } catch (err) {
        logger.warn({ err, pattern }, 'delPattern unlink failed');
      }
    }
  } while (cursor !== '0');
  return removed;
};

/**
 * Acquire-and-run helper for non-cache singleflight (e.g. one-shot refresh
 * of a derived aggregate). Returns `null` if the lock could not be taken.
 */
export const withLock = async <T>(
  lockKey: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T | null> => {
  const ok = await redis.set(lockKey, '1', 'PX', ttlMs, 'NX');
  if (ok !== 'OK') return null;
  try {
    return await fn();
  } finally {
    await redis.del(lockKey).catch(() => {});
  }
};
