import type { Request } from 'express';
import { AppError } from './AppError';

// `req.params.x` is typed as `string | undefined` even after Zod has
// validated it, so handlers end up sprinkling `!` everywhere. This helper
// returns a plain string and throws a 400 if the param is somehow missing
// (it never should be after validation, but better to surface explicitly).
export const param = (req: Request, key: string): string => {
  const v = req.params[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw AppError.badRequest(`Missing path parameter: ${key}`);
  }
  return v;
};
