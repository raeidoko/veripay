import { randomUUID } from 'node:crypto';
import type { ProductReview, ProductReviewSummary, UserProfile } from '../../shared/types.ts';
import { registerState } from '../db/persistence.ts';

const reviews: ProductReview[] = [];
registerState('reviews', reviews);

export const productReviewService = {
  getSummary(productId: string): ProductReviewSummary {
    const items = reviews.filter(review => review.productId === productId && !review.hidden)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const average = items.length ? items.reduce((sum, item) => sum + item.rating, 0) / items.length : 0;
    return { reviews: items, rating: Math.round(average * 10) / 10, reviewsCount: items.length };
  },

  getAll() { return [...reviews]; },
  moderate(id: string, hidden: boolean) {
    const review = reviews.find(item => item.id === id);
    if (!review) throw new Error('Review not found');
    review.hidden = hidden;
  },

  save(productId: string, buyer: UserProfile, rating: unknown, comment: unknown): ProductReviewSummary {
    if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
      throw new Error('Choose a rating from 1 to 5 stars');
    }
    if (typeof comment !== 'string' || comment.trim().length < 3 || comment.trim().length > 1000) {
      throw new Error('Write a review between 3 and 1,000 characters');
    }
    const now = new Date().toISOString();
    const existing = reviews.find(review => review.productId === productId && review.buyerId === buyer.id);
    if (existing) {
      existing.rating = rating as number;
      existing.comment = comment.trim();
      existing.updatedAt = now;
    } else {
      reviews.push({ id: randomUUID(), productId, buyerId: buyer.id, buyerName: buyer.name,
        rating: rating as number, comment: comment.trim(), createdAt: now, updatedAt: now });
    }
    return this.getSummary(productId);
  },
};
