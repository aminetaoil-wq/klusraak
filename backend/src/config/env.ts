import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGIN: z.string().default('*'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required').default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),

  // Cache TTLs (seconds). Tune per traffic pattern; defaults match the design doc.
  CACHE_TTL_CATEGORIES: z.coerce.number().int().positive().default(3600),
  CACHE_TTL_FEED: z.coerce.number().int().positive().default(30),
  CACHE_TTL_JOB: z.coerce.number().int().positive().default(60),
  CACHE_TTL_USER: z.coerce.number().int().positive().default(120),
  CACHE_TTL_IDEMPOTENCY: z.coerce.number().int().positive().default(86_400),

  // Worker
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
