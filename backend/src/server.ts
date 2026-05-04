import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { closeRedis } from './cache/redis';
import { closeQueues } from './queue/queues';

const SHUTDOWN_TIMEOUT_MS = 25_000;

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'KlusRaak API listening');
});

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');

  const closeServer = new Promise<void>((resolve) => {
    server.close(() => {
      logger.info('HTTP server closed');
      resolve();
    });
  });

  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), SHUTDOWN_TIMEOUT_MS),
  );
  const result = await Promise.race([closeServer.then(() => 'closed' as const), timeout]);
  if (result === 'timeout') {
    logger.warn({ ms: SHUTDOWN_TIMEOUT_MS }, 'shutdown timeout; forcing exit');
  }

  await Promise.allSettled([prisma.$disconnect(), closeQueues(), closeRedis()]);
  logger.info('shutdown complete');
  process.exit(result === 'timeout' ? 1 : 0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
