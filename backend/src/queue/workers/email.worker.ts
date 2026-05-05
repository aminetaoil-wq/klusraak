import { Worker, type Worker as BullWorker } from 'bullmq';
import { redis } from '../../cache/redis';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { recordQueueJob } from '../../observability/metrics';
import { QUEUE_NAMES, type EmailJobData } from '../jobs.types';

// Stub provider. In production, swap the body of `send` for an SES /
// SendGrid client call. The interface stays identical.
const send = async (data: EmailJobData): Promise<void> => {
  logger.info(
    { to: data.to, subject: data.subject, template: data.template, reqId: data.reqId },
    'email send (stub)',
  );
};

export const startEmailWorker = (): BullWorker<EmailJobData> => {
  const w = new Worker<EmailJobData>(QUEUE_NAMES.email, async (job) => send(job.data), {
    connection: redis,
    concurrency: env.WORKER_CONCURRENCY,
  });
  w.on('completed', () => recordQueueJob(QUEUE_NAMES.email, 'completed'));
  w.on('failed', (_job, err) => {
    recordQueueJob(QUEUE_NAMES.email, 'failed');
    logger.error({ err }, 'email worker failed');
  });
  return w;
};
