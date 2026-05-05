import { Worker, type Worker as BullWorker } from 'bullmq';
import { redis } from '../../cache/redis';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { recordQueueJob } from '../../observability/metrics';
import { QUEUE_NAMES, type PushJobData } from '../jobs.types';

// Stub provider. Swap for APNs / FCM / Web Push in production.
const send = async (data: PushJobData): Promise<void> => {
  logger.info(
    { userId: data.userId, title: data.title, reqId: data.reqId },
    'push send (stub)',
  );
};

export const startPushWorker = (): BullWorker<PushJobData> => {
  const w = new Worker<PushJobData>(QUEUE_NAMES.push, async (job) => send(job.data), {
    connection: redis,
    concurrency: env.WORKER_CONCURRENCY,
  });
  w.on('completed', () => recordQueueJob(QUEUE_NAMES.push, 'completed'));
  w.on('failed', (_job, err) => {
    recordQueueJob(QUEUE_NAMES.push, 'failed');
    logger.error({ err }, 'push worker failed');
  });
  return w;
};
