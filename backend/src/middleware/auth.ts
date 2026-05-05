import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Role } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import type { AuthedUser } from '../types/express';

// A request that has already passed `requireAuth`. Use this in handlers to
// drop `req.user!` non-null assertions:
//
//   const handler = (req: AuthedRequest, ...) => req.user.id
export type AuthedRequest = Request & { user: AuthedUser };

const VALID_ROLES = new Set<Role>(Object.values(Role));

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Missing bearer token'));
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    if (!VALID_ROLES.has(payload.role as Role)) {
      return next(AppError.unauthorized('Token has unknown role'));
    }
    req.user = { id: payload.sub, role: payload.role as Role };
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired token'));
  }
};

export const requireRole =
  (...allowed: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!allowed.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
