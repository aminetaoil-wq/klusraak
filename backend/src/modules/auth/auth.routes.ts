import { Router } from 'express';
import * as ctrl from './auth.controller';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { httpCache } from '../../cache/httpCache';
import { loginSchema, refreshSchema, registerSchema } from './auth.schemas';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), asyncHandler(ctrl.register));
authRouter.post('/login', validate(loginSchema), asyncHandler(ctrl.login));
authRouter.post('/refresh', validate(refreshSchema), asyncHandler(ctrl.refresh));
authRouter.post('/logout', validate(refreshSchema), asyncHandler(ctrl.logout));
authRouter.get(
  '/me',
  requireAuth,
  // ETag for browser 304s; never share a private response across users.
  httpCache({ visibility: 'private', maxAge: 0 }),
  asyncHandler(ctrl.me),
);
