import {
  notificationsQueue,
  reviewAggregatesQueue,
  emailQueue,
  pushQueue,
} from './queues';
import type {
  EmailJobData,
  NotificationFanoutData,
  PushJobData,
  ReviewAggregateRefreshData,
} from './jobs.types';
import { logger } from '../config/logger';

// Producers swallow enqueue errors and log them — the DB row is the source
// of truth, so the worst case is a missing side-effect (email/push), not a
// missing record. The HTTP request still succeeds.

export const enqueueNotificationFanout = async (data: NotificationFanoutData): Promise<void> => {
  try {
    // jobId = notificationId makes enqueue idempotent against retries.
    await notificationsQueue.add('fanout', data, { jobId: data.notificationId });
  } catch (err) {
    logger.error({ err, data }, 'enqueueNotificationFanout failed');
  }
};

export const enqueueReviewAggregateRefresh = async (
  data: ReviewAggregateRefreshData,
): Promise<void> => {
  try {
    await reviewAggregatesQueue.add('refresh', data, { jobId: `review-agg:${data.userId}` });
  } catch (err) {
    logger.error({ err, data }, 'enqueueReviewAggregateRefresh failed');
  }
};

export const enqueueEmail = async (data: EmailJobData): Promise<void> => {
  try {
    await emailQueue.add('send', data);
  } catch (err) {
    logger.error({ err }, 'enqueueEmail failed');
  }
};

export const enqueuePush = async (data: PushJobData): Promise<void> => {
  try {
    await pushQueue.add('send', data);
  } catch (err) {
    logger.error({ err }, 'enqueuePush failed');
  }
};
