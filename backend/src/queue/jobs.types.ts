// Discriminated union of all background-job payloads. Sharing this between
// producers (API) and consumers (worker) makes the queue contract a
// compile-time concern.

export interface NotificationFanoutData {
  notificationId: string;
  reqId?: string;
}

export interface ReviewAggregateRefreshData {
  userId: string;
  reqId?: string;
}

export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  props: Record<string, unknown>;
  reqId?: string;
}

export interface PushJobData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  reqId?: string;
}

export const QUEUE_NAMES = {
  notifications: 'notifications',
  email: 'email',
  push: 'push',
  reviewAggregates: 'reviewAggregates',
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface JobMap {
  [QUEUE_NAMES.notifications]: NotificationFanoutData;
  [QUEUE_NAMES.email]: EmailJobData;
  [QUEUE_NAMES.push]: PushJobData;
  [QUEUE_NAMES.reviewAggregates]: ReviewAggregateRefreshData;
}
