import { Prisma } from '@prisma/client';

// Centralised include shape for the Job aggregate. Keeping it here
// guarantees consistent shapes across services that touch jobs and lets us
// evolve the response shape in one place.

export const JOB_INCLUDE = {
  category: true,
  client: { select: { id: true, name: true, avatarUrl: true } },
  assignment: {
    include: { craftsman: { select: { id: true, name: true, avatarUrl: true } } },
  },
} satisfies Prisma.JobInclude;

export type JobWithRelations = Prisma.JobGetPayload<{ include: typeof JOB_INCLUDE }>;
