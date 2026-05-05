import { JobStatus, NotificationType, Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { JOB_INCLUDE, type JobWithRelations } from './jobs.selectors';
import type { CreateJobInput, ListJobsQuery, UpdateJobInput } from './jobs.schemas';
import { getOrSet } from '../../cache/redisCache';

const notify = (
  tx: Prisma.TransactionClient,
  userId: string,
  type: NotificationType,
  payload: Prisma.InputJsonValue,
) => tx.notification.create({ data: { userId, type, payload } });

// Mutators return both the updated job and the notification(s) the route
// layer should fan out post-commit. Keeping enqueue out of the transaction
// avoids enqueueing work that may roll back.
export interface MutationResult {
  job: JobWithRelations;
  notifications: string[];
}

const feedKey = (q: ListJobsQuery): string =>
  `jobs:open:v1:cat=${q.categoryId ?? ''}:city=${(q.city ?? '').toLowerCase()}:cur=${q.cursor ?? ''}:lim=${q.limit}`;

export const createJob = async (clientId: string, input: CreateJobInput): Promise<JobWithRelations> => {
  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw AppError.badRequest('Unknown category');

  return prisma.job.create({ data: { ...input, clientId }, include: JOB_INCLUDE });
};

export const updateJob = async (
  clientId: string,
  jobId: string,
  input: UpdateJobInput,
): Promise<JobWithRelations> => {
  const existing = await prisma.job.findUnique({ where: { id: jobId } });
  if (!existing) throw AppError.notFound('Job not found');
  if (existing.clientId !== clientId) throw AppError.forbidden();
  if (existing.status !== JobStatus.OPEN) {
    throw AppError.conflict('Job can only be edited while OPEN');
  }
  return prisma.job.update({ where: { id: jobId }, data: input, include: JOB_INCLUDE });
};

export const listOpenJobs = async (params: ListJobsQuery) => {
  return getOrSet(feedKey(params), env.CACHE_TTL_FEED, async () => {
    const where: Prisma.JobWhereInput = {
      status: JobStatus.OPEN,
      ...(params.categoryId && { categoryId: params.categoryId }),
      ...(params.city && { city: { equals: params.city, mode: 'insensitive' } }),
    };

    const items = await prisma.job.findMany({
      where,
      include: JOB_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: params.limit + 1,
      ...(params.cursor && { cursor: { id: params.cursor }, skip: 1 }),
    });

    const hasMore = items.length > params.limit;
    const trimmed = hasMore ? items.slice(0, -1) : items;
    return {
      items: trimmed,
      nextCursor: hasMore ? trimmed[trimmed.length - 1]!.id : null,
    };
  });
};

const MY_JOBS_LIMIT = 100;

export const listMyJobs = async (userId: string, role: Role): Promise<JobWithRelations[]> => {
  const where: Prisma.JobWhereInput =
    role === Role.CLIENT
      ? { clientId: userId }
      : { assignment: { craftsmanId: userId } };

  return prisma.job.findMany({
    where,
    include: JOB_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: MY_JOBS_LIMIT,
  });
};

const fetchJob = async (jobId: string): Promise<JobWithRelations | null> =>
  prisma.job.findUnique({ where: { id: jobId }, include: JOB_INCLUDE });

export const getJob = async (
  jobId: string,
  userId: string,
  role: Role,
): Promise<JobWithRelations> => {
  // Cache only the per-id read; the visibility check still runs every call.
  // OPEN jobs are excluded from the cache because their status flips
  // frequently the moment they're accepted.
  const job = await getOrSet(`job:${jobId}`, env.CACHE_TTL_JOB, async () => {
    const j = await fetchJob(jobId);
    if (!j) throw AppError.notFound('Job not found');
    return j;
  });

  if (job.status === JobStatus.OPEN && role === Role.CRAFTSMAN) return job;
  if (job.clientId === userId) return job;
  if (job.assignment?.craftsmanId === userId) return job;
  throw AppError.forbidden();
};

// Atomic: only one craftsman can win an OPEN job. Relies on the unique
// constraint on JobAssignment.jobId — concurrent acceptors hit Prisma P2002
// which the global error handler maps to 409 Conflict.
export const acceptJob = async (jobId: string, craftsmanId: string): Promise<MutationResult> =>
  prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: jobId } });
    if (!job) throw AppError.notFound('Job not found');
    if (job.status !== JobStatus.OPEN) throw AppError.conflict('Job is no longer open');

    await tx.jobAssignment.create({ data: { jobId, craftsmanId } });
    const updated = await tx.job.update({
      where: { id: jobId },
      data: { status: JobStatus.ASSIGNED },
      include: JOB_INCLUDE,
    });

    const n = await notify(tx, job.clientId, NotificationType.JOB_ACCEPTED, { jobId });
    return { job: updated, notifications: [n.id] };
  });

const transitionStatus = async (
  jobId: string,
  craftsmanId: string,
  from: JobStatus,
  to: JobStatus,
  notif: NotificationType,
): Promise<MutationResult> =>
  prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: jobId }, include: { assignment: true } });
    if (!job) throw AppError.notFound('Job not found');
    if (job.assignment?.craftsmanId !== craftsmanId) throw AppError.forbidden();
    if (job.status !== from) {
      throw AppError.conflict(`Cannot transition from ${job.status} to ${to}`);
    }

    const updated = await tx.job.update({
      where: { id: jobId },
      data: { status: to },
      include: JOB_INCLUDE,
    });

    if (to === JobStatus.IN_PROGRESS) {
      await tx.jobAssignment.update({ where: { jobId }, data: { startedAt: new Date() } });
    }
    if (to === JobStatus.COMPLETED) {
      await tx.jobAssignment.update({ where: { jobId }, data: { completedAt: new Date() } });
    }

    const n = await notify(tx, job.clientId, notif, { jobId });
    return { job: updated, notifications: [n.id] };
  });

export const startJob = (jobId: string, craftsmanId: string): Promise<MutationResult> =>
  transitionStatus(jobId, craftsmanId, JobStatus.ASSIGNED, JobStatus.IN_PROGRESS, NotificationType.JOB_STARTED);

export const completeJob = (jobId: string, craftsmanId: string): Promise<MutationResult> =>
  transitionStatus(jobId, craftsmanId, JobStatus.IN_PROGRESS, JobStatus.COMPLETED, NotificationType.JOB_COMPLETED);

export const cancelJob = async (jobId: string, clientId: string): Promise<MutationResult> =>
  prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: jobId }, include: { assignment: true } });
    if (!job) throw AppError.notFound('Job not found');
    if (job.clientId !== clientId) throw AppError.forbidden();
    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED) {
      throw AppError.conflict(`Job is already ${job.status}`);
    }

    const updated = await tx.job.update({
      where: { id: jobId },
      data: { status: JobStatus.CANCELLED },
      include: JOB_INCLUDE,
    });

    const notifications: string[] = [];
    if (job.assignment) {
      const n = await notify(tx, job.assignment.craftsmanId, NotificationType.JOB_CANCELLED, { jobId });
      notifications.push(n.id);
    }
    return { job: updated, notifications };
  });
