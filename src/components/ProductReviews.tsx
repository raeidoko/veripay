import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import type { ProductReviewSummary, UserProfile } from '../shared/types.ts';
import { api } from '../client/api.ts';

interface Props {
  productId: string;
  currentUser: UserProfile;
  onSaved: (summary: ProductReviewSummary) => void;
}

export function ProductReviews({ productId, currentUser, onSaved }: Props) {
  const [summary, setSummary] = useState<ProductReviewSummary | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const myReview = summary?.reviews.find(review => review.buyerId === currentUser.id);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getProductReviews(productId).then(data => {
      if (cancelled) return;
      setSummary(data);
      const own = data.reviews.find(review => review.buyerId === currentUser.id);
      setRating(own?.rating || 0);
      setComment(own?.comment || '');
    }).catch(err => { if (!cancelled) setError(err.message || 'Could not load reviews'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [productId, currentUser.id, retry]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!rating) { setError('Choose a star rating first'); return; }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api.saveProductReview(productId, rating, comment);
      setSummary(result);
      setComment(result.reviews.find(review => review.buyerId === currentUser.id)?.comment || '');
      setNotice(myReview ? 'Your review has been updated.' : 'Your review has been posted.');
      onSaved(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save your review');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="product-reviews-heading" className="border-t border-slate-200 pt-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 id="product-reviews-heading" className="text-sm font-bold text-slate-900">Buyer reviews</h4>
        {summary && summary.reviewsCount > 0 && <span className="text-xs text-slate-600">
          <span className="text-amber-500" aria-hidden="true">★</span> {summary.rating.toFixed(1)} / 5 · {summary.reviewsCount} {summary.reviewsCount === 1 ? 'review' : 'reviews'}
        </span>}
      </div>

      {loading ? <p role="status" className="text-xs text-slate-500">Loading reviews…</p> : <>
        {summary && summary.reviews.length === 0 && <p className="text-xs text-slate-500">No reviews yet. Be the first to share your thoughts.</p>}
        {summary && <ul className="space-y-3 max-h-64 overflow-y-auto">
          {summary.reviews.map(review => <li key={review.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex justify-between gap-3 text-xs">
              <strong className="text-slate-800">{review.buyerName} {review.buyerId === currentUser.id && <span className="font-normal text-brand-600">· Your review</span>}</strong>
              <span aria-label={`${review.rating} out of 5 stars`} className="shrink-0 text-amber-500">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
            </div>
            <p className="text-xs text-slate-600 whitespace-pre-wrap break-words">{review.comment}</p>
            <time dateTime={review.updatedAt} className="block text-[11px] text-slate-400">
              {review.updatedAt !== review.createdAt ? 'Updated ' : ''}{new Date(review.updatedAt).toLocaleDateString()}
            </time>
          </li>)}
        </ul>}

        {summary && currentUser.role === 'buyer' && <form onSubmit={submit} className="rounded-xl border border-brand-100 bg-brand-50/40 p-4 space-y-3">
          <div>
            <h5 className="text-xs font-bold text-slate-900">{myReview ? 'Update your review' : 'Write a review'}</h5>
            <p className="mt-1 text-[11px] text-slate-500">Share your thoughts before or after buying this product.</p>
          </div>
          <fieldset disabled={saving}>
            <legend className="text-xs font-medium text-slate-700 mb-1">Your rating</legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(value => <label key={value} className="cursor-pointer rounded-md p-1 focus-within:ring-2 focus-within:ring-brand-500">
                <input type="radio" name="review-rating" value={value} checked={rating === value} onChange={() => setRating(value)} aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`} className="sr-only" />
                <Star aria-hidden="true" className={`h-6 w-6 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
              </label>)}
            </div>
          </fieldset>
          <div>
            <label htmlFor="product-review-comment" className="block text-xs font-medium text-slate-700 mb-1">Your review</label>
            <textarea id="product-review-comment" value={comment} onChange={event => setComment(event.target.value)} required minLength={3} maxLength={1000} rows={3} disabled={saving}
              placeholder="What do you think of this product?" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <p className="text-right text-[10px] text-slate-400">{comment.length}/1,000</p>
          </div>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Saving…' : myReview ? 'Update my review' : 'Post review'}
          </button>
        </form>}
      </>}
      {error && <div role="alert" className="text-xs text-rose-700">{error} {!summary && !loading && <button type="button" onClick={() => setRetry(value => value + 1)} className="ml-2 underline">Try again</button>}</div>}
      {notice && <p role="status" className="text-xs text-emerald-700">{notice}</p>}
    </section>
  );
}
