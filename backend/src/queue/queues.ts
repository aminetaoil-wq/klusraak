import { Queue, type QueueOptions } from 'bullmq';
import { redis } from '../cache/redis';
import { QUEUE_NAMES, type JobMap, type QueueName } from './jobs.types';
import { logger } from '../config/logger';

// BullMQ requires the connection it uses to have `maxRetriesPerRequest: null`.
// Our shared `redis` client is configured that way already (see cache/redis.ts).
const baseOpts = (): QueueOptions => ({
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 500 },
    removeOnComplete: { age: 3600, count: 5000 },
    removeOnFail: { age: 86_400, count: 5000 },
  },
});

declare global {
  // eslint-disable-next-line no-var
  var __queues: Partial<Record<QueueName, Queue>> | undefined;
}
const slot: Partial<Record<QueueName, Queue>> = global.__queues ?? (global.__queues = {});

const make = <K extends QueueName>(name: K): Queue<JobMap[K]> => {
  if (slot[name]) return slot[name] as Queue<JobMap[K]>;
  const q = new Queue<JobMap[K]>(name, baseOpts());
  q.on('error', (err) => logger.error({ err, queue: name }, 'queue error'));
  slot[name] = q;
  return q;
};

export const notificationsQueue = make(QUEUE_NAMES.notifications);
export const emailQueue = make(QUEUE_NAMES.email);
export const pushQueue = make(QUEUE_NAMES.push);
export const reviewAggregatesQueue = make(QUEUE_NAMES.reviewAggregates);

export const closeQueues = async (): Promise<void> => {
  await Promise.allSettled(
    Object.values(slot).filter((q): q is Queue => !!q).map((q) => q.close()),
  );
};
