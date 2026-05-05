import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { redis } from '../cache/redis';

const TIMEOUT_MS = 500;

const withTimeout = async <T>(p: Promise<T>): Promise<T> => {
  let t: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t!);
  }
};

// Liveness: 200 once the process is up. No DB/Redis check (avoids cascading
// restarts on transient hiccups).
export const liveness = (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
};

// Readiness: 200 only when both Postgres and Redis answer within 500 ms.
// The reverse proxy / orchestrator routes traffic on this.
export const readiness = async (_req: Request, res: Response) => {
  const [dbOk, redisOk] = await Promise.all([
    withTimeout(prisma.$queryRaw`SELECT 1`)
      .then(() => true)
      .catch(() => false),
    withTimeout(redis.ping())
      .then((reply) => reply === 'PONG')
      .catch(() => false),
  ]);
  const ok = dbOk && redisOk;
  res.status(ok ? 200 : 503).json({ ok, db: dbOk, redis: redisOk });
};
