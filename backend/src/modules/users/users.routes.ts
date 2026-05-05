import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import * as service from './users.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { param } from '../../utils/params';
import { invalidateUser } from '../../cache/invalidate';
import { updateCraftsmanSchema, updateMeSchema } from './users.schemas';

export const usersRouter = Router();

usersRouter.patch(
  '/me',
  requireAuth,
  validate(updateMeSchema),
  asyncHandler(async (req, res) => {
    const user = await service.updateMe(req.user!.id, req.body);
    await invalidateUser(req.user!.id);
    res.json({ user });
  }),
);

usersRouter.patch(
  '/me/craftsman',
  requireAuth,
  requireRole(Role.CRAFTSMAN),
  validate(updateCraftsmanSchema),
  asyncHandler(async (req, res) => {
    const profile = await service.updateCraftsmanProfile(req.user!.id, req.body);
    await invalidateUser(req.user!.id);
    res.json({ profile });
  }),
);

const idParam = z.object({ id: z.string().min(1) });

usersRouter.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const user = await service.getPublicProfile(param(req, 'id'));
    res.json({ user });
  }),
);

usersRouter.get(
  '/:id/reviews',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const user = await service.getPublicProfile(param(req, 'id'));
    res.json({ reviews: user.reviewsReceived });
  }),
);
