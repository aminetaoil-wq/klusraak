import type { Role } from '@prisma/client';

export interface AuthedUser {
  id: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    id?: string;
    user?: AuthedUser;
  }
}

export {};
