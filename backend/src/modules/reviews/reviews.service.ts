import { JobStatus, NotificationType, type Review } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';

export interface CreateReviewResult {
  review: Review;
  toId: string;
  notificationId: string;
}

export const createReview = async (
  jobId: string,
  fromId: string,
  rating: number,
  comment?: string,
): Promise<CreateReviewResult> =>
  prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({
      where: { id: jobId },
      include: { assignment: true },
    });
    if (!job) throw AppError.notFound('Job not found');
    if (job.status !== JobStatus.COMPLETED) {
      throw AppError.conflict('Reviews are only allowed on completed jobs');
    }
    if (!job.assignment) throw AppError.conflict('Job has no assignment');

    const isClient = job.clientId === fromId;
    const isCraftsman = job.assignment.craftsmanId === fromId;
    if (!isClient && !isCraftsman) throw AppError.forbidden();

    const toId = isClient ? job.assignment.craftsmanId : job.clientId;

    const review = await tx.review.create({
      data: { jobId, fromId, toId, rating, comment },
    });
    const notification = await tx.notification.create({
      data: {
        userId: toId,
        type: NotificationType.NEW_REVIEW,
        payload: { jobId, reviewId: review.id },
      },
    });
    return { review, toId, notificationId: notification.id };
  });
