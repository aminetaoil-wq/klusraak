import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(72),
  name: z.string().min(2).max(80).trim(),
  phone: z.string().min(6).max(20).optional(),
  role: z.enum(['CLIENT', 'CRAFTSMAN']),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});
export type RefreshInput = z.infer<typeof refreshSchema>;
