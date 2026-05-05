import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { getOrSet } from '../../cache/redisCache';
import { PUBLIC_USER_SELECT } from './users.selectors';
import type { UpdateCraftsmanInput, UpdateMeInput } from './users.schemas';

export const updateMe = async (userId: string, input: UpdateMeInput) =>
  prisma.user.update({
    where: { id: userId },
    data: input,
    select: PUBLIC_USER_SELECT,
  });

export const updateCraftsmanProfile = async (userId: string, input: UpdateCraftsmanInput) => {
  const profile = await prisma.craftsmanProfile.findUnique({ where: { userId } });
  if (!profile) throw AppError.notFound('Craftsman profile not found');

  const { categoryIds, ...rest } = input;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.craftsmanProfile.update({
      where: { userId },
      data: rest,
    });

    if (categoryIds) {
      await tx.categoryOnCraftsman.deleteMany({ where: { craftsmanId: profile.id } });
      if (categoryIds.length > 0) {
        await tx.categoryOnCraftsman.createMany({
          data: categoryIds.map((categoryId) => ({ craftsmanId: profile.id, categoryId })),
          skipDuplicates: true,
        });
      }
    }

    return tx.craftsmanProfile.findUnique({
      where: { id: updated.id },
      include: { categories: { include: { category: true } } },
    });
  });
};

const loadPublicProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      craftsmanProfile: {
        select: {
          bio: true,
          city: true,
          hourlyRate: true,
          verified: true,
          categories: { include: { category: true } },
        },
      },
      reviewsReceived: {
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          from: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!user) throw AppError.notFound('User not found');

  const ratingAgg = await prisma.review.aggregate({
    where: { toId: userId },
    _avg: { rating: true },
    _count: true,
  });

  return {
    ...user,
    rating: ratingAgg._avg.rating ?? null,
    ratingCount: ratingAgg._count,
  };
};

export const getPublicProfile = async (userId: string) =>
  getOrSet(`user:pub:${userId}`, env.CACHE_TTL_USER, () => loadPublicProfile(userId));
