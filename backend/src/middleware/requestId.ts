import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const HEADER = 'x-request-id';

// Adopt an upstream id if a load balancer set one; otherwise mint a UUID.
// Echoed back so clients (and curl) can quote it in a bug report.
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.header(HEADER);
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  req.id = id;
  res.setHeader(HEADER, id);
  next();
};
