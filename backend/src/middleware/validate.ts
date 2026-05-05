import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

type Source = 'body' | 'query' | 'params';

// Replaces req[source] with the parsed (and now typed) value.
export const validate =
  <T>(schema: ZodSchema<T>, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    (req as unknown as Record<Source, unknown>)[source] = result.data;
    next();
  };
