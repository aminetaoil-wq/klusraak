import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { getOrSet } from '../../cache/redisCache';
import { httpCache } from '../../cache/httpCache';
import { onInvalidate } from '../../cache/invalidate';
import { TTLCache } from '../../cache/lru';
import { recordCacheHit } from '../../observability/metrics';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  group: string | null;
  createdAt: Date;
}

// L3 cache: a single-key in-process LRU. Drops itself on pub/sub
// invalidation so other replicas mutating categories take effect immediately.
const lru = new TTLCache<Category[]>(1);
const LRU_TTL_MS = 60_000;
const LRU_KEY = 'cat:all';

onInvalidate((key) => {
  if (key === LRU_KEY) lru.del(LRU_KEY);
});

const loadCategories = (): Promise<Category[]> =>
  prisma.category.findMany({ orderBy: { name: 'asc' } });

export const categoriesRouter = Router();

categoriesRouter.get(
  '/',
  httpCache({ visibility: 'public', maxAge: 300, swr: 600 }),
  asyncHandler(async (_req, res) => {
    const cached = lru.get(LRU_KEY);
    if (cached) {
      recordCacheHit('lru', 'cat');
      res.json({ categories: cached });
      return;
    }
    const categories = await getOrSet<Category[]>(
      LRU_KEY,
      env.CACHE_TTL_CATEGORIES,
      loadCategories,
    );
    lru.set(LRU_KEY, categories, LRU_TTL_MS);
    res.json({ categories });
  }),
);
