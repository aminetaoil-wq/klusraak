import { Router } from 'express';
import * as service from './reviews.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { param } from '../../utils/params';
import { createReviewSchema } from './reviews.schemas';
import { invalidateUser } from '../../cache/invalidate';
import {
  enqueueNotificationFanout,
  enqueueReviewAggregateRefresh,
} from '../../queue/enqueue';

// Mounted at /api/jobs/:id/reviews.
export const reviewsRouter = Router({ mergeParams: true });

reviewsRouter.post(
  '/',
  validate(createReviewSchema),
  asyncHandler(async (req, res) => {
    const { review, toId, notificationId } = await service.createReview(
      param(req, 'id'),
      req.user!.id,
      req.body.rating,
      req.body.comment,
    );
    await invalidateUser(toId);
    await enqueueReviewAggregateRefresh({ userId: toId, reqId: req.id });
    await enqueueNotificationFanout({ notificationId, reqId: req.id });
    res.status(201).json({ review });
  }),
);
