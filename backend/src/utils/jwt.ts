import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessPayload {
  sub: string;
  role: 'CLIENT' | 'CRAFTSMAN' | 'ADMIN';
}

export const signAccessToken = (payload: AccessPayload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } satisfies SignOptions);

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload & { iat: number; exp: number };

// Refresh tokens are opaque random bytes — not JWTs — so we can revoke them
// individually by deleting the row. We store the SHA-256 of the token, never
// the plaintext.
export const generateRefreshToken = () => crypto.randomBytes(48).toString('base64url');
export const hashRefreshToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');
