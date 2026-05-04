import { logger } from './config/logger';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { closeRedis } from './cache/redis';
import { closeQueues } from './queue/queues';
import { startNotificationsWorker } from './queue/workers/notifications.worker';
import { startEmailWorker } from './queue/workers/email.worker';
import { startPushWorker } from './queue/workers/push.worker';
import { startReviewAggregatesWorker } from './queue/workers/reviewAggregates.worker';

const workers = [
  startNotificationsWorker(),
  startEmailWorker(),
  startPushWorker(),
  startReviewAggregatesWorker(),
];

logger.info(
  { concurrency: env.WORKER_CONCURRENCY, queues: workers.length, env: env.NODE_ENV },
  'KlusRaak worker started',
);

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'worker shutting down');
  await Promise.allSettled(workers.map((w) => w.close()));
  await closeQueues();
  await prisma.$disconnect();
  await closeRedis();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
