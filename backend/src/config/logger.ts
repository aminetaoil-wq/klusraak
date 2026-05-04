import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
      : undefined,
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.passwordHash'],
    censor: '[REDACTED]',
  },
});
