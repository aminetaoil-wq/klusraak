import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Prisma keeps a connection pool. We share a single instance across the
// process so dev/HMR and serverless cold starts don't open dozens of pools.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
