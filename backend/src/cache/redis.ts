import IORedis, { type Redis } from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Three logical clients sharing one URL. We use distinct instances because
// a Redis connection that has issued SUBSCRIBE cannot run normal commands —
// pub/sub needs its own client. BullMQ has the same constraint, so we hand
// it a dedicated factory in queue/queues.ts.
declare global {
  // eslint-disable-next-line no-var
  var __redis: { main?: Redis; sub?: Redis } | undefined;
}

const make = (label: string): Redis => {
  const c = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // BullMQ requires this; harmless for the main client.
    enableReadyCheck: true,
    lazyConnect: false,
  });
  c.on('error', (err) => logger.error({ err, label }, 'redis error'));
  c.on('connect', () => logger.debug({ label }, 'redis connected'));
  return c;
};

const slot = global.__redis ?? (global.__redis = {});
export const redis: Redis = slot.main ?? (slot.main = make('main'));
export const redisSub: Redis = slot.sub ?? (slot.sub = make('sub'));

export const closeRedis = async () => {
  await Promise.allSettled([redis.quit(), redisSub.quit()]);
};
