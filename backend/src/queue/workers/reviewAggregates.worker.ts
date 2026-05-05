import { Worker, type Worker as BullWorker } from 'bullmq';
import { redis } from '../../cache/redis';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { recordQueueJob } from '../../observability/metrics';
import { invalidateUser } from '../../cache/invalidate';
import { QUEUE_NAMES, type ReviewAggregateRefreshData } from '../jobs.types';

/**
 * Recompute the per-user review aggregate (avg rating + count) and drop
 * the cached public profile so the next read picks up the new numbers.
 *
 * Today the API also calls `invalidateUser` directly for fast feedback;
 * this worker is a safety net + a hook for any future denormalisation
 * (e.g. a `User.ratingAvg` column) without changing the request path.
 */
const handler = async (job: { data: ReviewAggregateRefreshData }) => {
  const { userId, reqId } = job.data;
  const agg = await prisma.review.aggregate({
    where: { toId: userId },
    _avg: { rating: true },
    _count: true,
  });
  await invalidateUser(userId);
  logger.info(
    { userId, avg: agg._avg.rating, count: agg._count, reqId },
    'reviewAggregates.refresh',
  );
};

export const startReviewAggregatesWorker = (): BullWorker<ReviewAggregateRefreshData> => {
  const w = new Worker<ReviewAggregateRefreshData>(QUEUE_NAMES.reviewAggregates, handler, {
    connection: redis,
    concurrency: env.WORKER_CONCURRENCY,
  });
  w.on('completed', () => recordQueueJob(QUEUE_NAMES.reviewAggregates, 'completed'));
  w.on('failed', (_job, err) => {
    recordQueueJob(QUEUE_NAMES.reviewAggregates, 'failed');
    logger.error({ err }, 'reviewAggregates worker failed');
  });
  return w;
};
