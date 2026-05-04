import { Role, type User } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { hashPassword, verifyPassword } from '../../utils/password';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from '../../utils/jwt';
import { PUBLIC_USER_SELECT } from '../users/users.selectors';
import type { LoginInput, RegisterInput } from './auth.schemas';

const sanitize = (u: User) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  phone: u.phone,
  avatarUrl: u.avatarUrl,
  createdAt: u.createdAt,
});

const issueTokens = async (user: User) => {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL * 1000),
    },
  });

  return { accessToken, refreshToken };
};

export const register = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict('Email already registered');

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name,
      phone: input.phone,
      role: input.role as Role,
      // Auto-create an empty craftsman profile so the craftsman can fill it in.
      ...(input.role === 'CRAFTSMAN' && {
        craftsmanProfile: { create: {} },
      }),
    },
  });

  const tokens = await issueTokens(user);
  return { user: sanitize(user), ...tokens };
};

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw AppError.unauthorized('Invalid credentials');
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw AppError.unauthorized('Invalid credentials');

  const tokens = await issueTokens(user);
  return { user: sanitize(user), ...tokens };
};

// Rotation strategy: on each refresh we invalidate the old token and issue
// a new one. Detected reuse of a revoked token wipes all of that user's
// refresh tokens (defense in depth).
export const refresh = async (refreshToken: string) => {
  const tokenHash = hashRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.expiresAt < new Date()) {
    throw AppError.unauthorized('Invalid refresh token');
  }
  if (stored.revokedAt) {
    await prisma.refreshToken.deleteMany({ where: { userId: stored.userId } });
    throw AppError.unauthorized('Refresh token reuse detected');
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw AppError.unauthorized();

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokens(user);
  return { user: sanitize(user), ...tokens };
};

export const logout = async (refreshToken: string) => {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

// Use a typed `select` so `passwordHash` cannot be returned by accident.
export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...PUBLIC_USER_SELECT,
      craftsmanProfile: {
        include: { categories: { include: { category: true } } },
      },
    },
  });
  if (!user) throw AppError.notFound('User not found');
  return user;
};
