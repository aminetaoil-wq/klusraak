import { z } from 'zod';

export const updateMeSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.string().min(6).max(20).optional(),
  avatarUrl: z.string().url().optional(),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const updateCraftsmanSchema = z.object({
  kvkNumber: z.string().min(4).max(20).optional(),
  bio: z.string().max(2000).optional(),
  hourlyRate: z.number().int().min(0).max(100000).optional(),
  city: z.string().min(2).max(80).optional(),
  categoryIds: z.array(z.string().min(1)).max(20).optional(),
});
export type UpdateCraftsmanInput = z.infer<typeof updateCraftsmanSchema>;
