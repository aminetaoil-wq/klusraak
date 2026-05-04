import type { Prisma } from '@prisma/client';

// The shape we expose for any user. Centralised so `passwordHash` cannot be
// returned by accident — Prisma's typed `select` makes it a compile error to
// add it here.
export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  phone: true,
  avatarUrl: true,
  createdAt: true,
} satisfies Prisma.UserSelect;
