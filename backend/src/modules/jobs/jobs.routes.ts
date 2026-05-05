import { Router } from 'express';
import { Role } from '@prisma/client';
import * as service from './jobs.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { idempotency } from '../../middleware/idempotency';
import { param } from '../../utils/params';
import {
  createJobSchema,
  idParamSchema,
  listJobsQuerySchema,
  updateJobSchema,
} from './jobs.schemas';
import { messagesRouter } from '../messages/messages.routes';
import { reviewsRouter } from '../reviews/reviews.routes';
import { invalidateJob, invalidateOpenFeed } from '../../cache/invalidate';
import { enqueueNotificationFanout } from '../../queue/enqueue';

export const jobsRouter = Router();

jobsRouter.use(requireAuth);

const fanout = (notificationIds: string[], reqId?: string) =>
  Promise.all(notificationIds.map((id) => enqueueNotificationFanout({ notificationId: id, reqId })));

jobsRouter.post(
  '/',
  requireRole(Role.CLIENT),
  idempotency(),
  validate(createJobSchema),
  asyncHandler(async (req, res) => {
    const job = await service.createJob(req.user!.id, req.body);
    await invalidateOpenFeed();
    res.status(201).json({ job });
  }),
);

jobsRouter.get(
  '/',
  requireRole(Role.CRAFTSMAN),
  validate(listJobsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listOpenJobs(req.query as never);
    res.json(result);
  }),
);

// `/me` is intentionally registered before `/:id` so it doesn't get matched
// as an id.
jobsRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const jobs = await service.listMyJobs(req.user!.id, req.user!.role);
    res.json({ jobs });
  }),
);

jobsRouter.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const job = await service.getJob(param(req, 'id'), req.user!.id, req.user!.role);
    res.json({ job });
  }),
);

jobsRouter.patch(
  '/:id',
  requireRole(Role.CLIENT),
  validate(idParamSchema, 'params'),
  validate(updateJobSchema),
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const job = await service.updateJob(req.user!.id, id, req.body);
    await Promise.all([invalidateJob(id), invalidateOpenFeed()]);
    res.json({ job });
  }),
);

jobsRouter.post(
  '/:id/accept',
  requireRole(Role.CRAFTSMAN),
  idempotency(),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const { job, notifications } = await service.acceptJob(id, req.user!.id);
    await Promise.all([invalidateJob(id), invalidateOpenFeed()]);
    await fanout(notifications, req.id);
    res.json({ job });
  }),
);

jobsRouter.post(
  '/:id/start',
  requireRole(Role.CRAFTSMAN),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const { job, notifications } = await service.startJob(id, req.user!.id);
    await invalidateJob(id);
    await fanout(notifications, req.id);
    res.json({ job });
  }),
);

jobsRouter.post(
  '/:id/complete',
  requireRole(Role.CRAFTSMAN),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const { job, notifications } = await service.completeJob(id, req.user!.id);
    await invalidateJob(id);
    await fanout(notifications, req.id);
    res.json({ job });
  }),
);

jobsRouter.post(
  '/:id/cancel',
  requireRole(Role.CLIENT),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const { job, notifications } = await service.cancelJob(id, req.user!.id);
    await Promise.all([invalidateJob(id), invalidateOpenFeed()]);
    await fanout(notifications, req.id);
    res.json({ job });
  }),
);

jobsRouter.use('/:id/messages', validate(idParamSchema, 'params'), messagesRouter);
jobsRouter.use('/:id/reviews', validate(idParamSchema, 'params'), reviewsRouter);
