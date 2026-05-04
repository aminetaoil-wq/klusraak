import { redis, redisSub } from './redis';
import { del, delPattern } from './redisCache';
import { logger } from '../config/logger';

const CHANNEL = 'cache:invalidate';

// Process-local invalidation listeners. Used so the categories LRU can
// register a `cat:all` drop hook without leaking the LRU import here.
type Listener = (key: string) => void;
const listeners = new Set<Listener>();

let subscribed = false;

export const onInvalidate = (fn: Listener): void => {
  listeners.add(fn);
};

const ensureSubscribed = async () => {
  if (subscribed) return;
  subscribed = true;
  redisSub.on('message', (channel, key) => {
    if (channel !== CHANNEL) return;
    for (const fn of listeners) {
      try {
        fn(key);
      } catch (err) {
        logger.warn({ err, key }, 'invalidate listener threw');
      }
    }
  });
  await redisSub.subscribe(CHANNEL).catch((err) => {
    logger.error({ err }, 'failed to subscribe to cache:invalidate');
  });
};

void ensureSubscribed();

const publish = async (key: string): Promise<void> => {
  try {
    await redis.publish(CHANNEL, key);
  } catch (err) {
    logger.warn({ err, key }, 'cache:invalidate publish failed');
  }
};

// Domain helpers. All combine local Redis DEL + cross-replica publish.

export const invalidateJob = async (jobId: string): Promise<void> => {
  const key = `job:${jobId}`;
  await del(key);
  await publish(key);
};

export const invalidateOpenFeed = async (): Promise<void> => {
  // Pattern-delete the per-filter cache keys, then publish a synthetic
  // "namespace" key so other replicas can drop matching LRU entries (none
  // today, but reserved).
  await delPattern('jobs:open:v1:*');
  await publish('jobs:open:v1:*');
};

export const invalidateUser = async (userId: string): Promise<void> => {
  const key = `user:pub:${userId}`;
  await del(key);
  await publish(key);
};

export const invalidateCategories = async (): Promise<void> => {
  const key = 'cat:all';
  await del(key);
  await publish(key);
};
