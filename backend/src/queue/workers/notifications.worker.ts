import { Worker, type Worker as BullWorker } from 'bullmq';
import { redis } from '../../cache/redis';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { recordQueueJob } from '../../observability/metrics';
import { QUEUE_NAMES, type NotificationFanoutData } from '../jobs.types';
import { enqueueEmail, enqueuePush } from '../enqueue';

/**
 * Reads the Notification row created in-tx by the API, decides which side
 * channels to dispatch (email/push), and enqueues those jobs. The DB is
 * still the source of truth — if this worker crashes the row remains and
 * is replayable.
 */
const handler = async (job: { data: NotificationFanoutData }) => {
  const { notificationId, reqId } = job.data;
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (!notification) {
    logger.warn({ notificationId, reqId }, 'notification missing; nothing to fan out');
    return;
  }

  const subject = `KlusRaak — ${notification.type.replace(/_/g, ' ').toLowerCase()}`;
  await enqueueEmail({
    to: notification.user.email,
    subject,
    template: notification.type,
    props: { name: notification.user.name, payload: notification.payload },
    reqId,
  });
  await enqueuePush({
    userId: notification.user.id,
    title: 'KlusRaak',
    body: subject,
    data: notification.payload as Record<string, unknown>,
    reqId,
  });

  logger.info({ notificationId, type: notification.type, reqId }, 'notification fanout');
};

export const startNotificationsWorker = (): BullWorker<NotificationFanoutData> => {
  const w = new Worker<NotificationFanoutData>(QUEUE_NAMES.notifications, handler, {
    connection: redis,
    concurrency: env.WORKER_CONCURRENCY,
  });
  w.on('completed', () => recordQueueJob(QUEUE_NAMES.notifications, 'completed'));
  w.on('failed', (_job, err) => {
    recordQueueJob(QUEUE_NAMES.notifications, 'failed');
    logger.error({ err }, 'notifications worker failed');
  });
  return w;
};
