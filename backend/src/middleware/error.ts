import type { ErrorRequestHandler, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';

interface ErrorBody {
  error: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

const send = (res: Response, status: number, body: ErrorBody, requestId?: string) => {
  res.status(status).json({ ...body, requestId });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const reqId = req.id;

  if (err instanceof AppError) {
    return send(res, err.statusCode, { error: err.code, message: err.message, details: err.details }, reqId);
  }

  if (err instanceof ZodError) {
    return send(res, 400, { error: 'validation_error', message: 'Invalid request', details: err.flatten() }, reqId);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return send(res, 409, { error: 'conflict', message: 'Resource already exists' }, reqId);
    }
    if (err.code === 'P2025') {
      return send(res, 404, { error: 'not_found', message: 'Resource not found' }, reqId);
    }
  }

  logger.error({ err, reqId }, 'Unhandled error');
  send(res, 500, { error: 'internal_error', message: 'Something went wrong' }, reqId);
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found', message: 'Route not found', requestId: req.id });
};
