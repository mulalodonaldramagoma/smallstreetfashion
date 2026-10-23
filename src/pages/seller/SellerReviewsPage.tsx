import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Star, CornerDownRight, Send, Edit2, Trash2, X, ShieldCheck, Package } from 'lucide-react';
import { SellerLayout } from '@/components/SellerLayout';
import { StarRating } from '@/components/StarRating';
import { useAuth } from '@/context/AuthContext';
import { useSellerStore } from '@/hooks/useData';
import { fetchStoreRatingSummary } from '@/services/reviewService';
import {
  fetchSellerStoreReviews,
  fetchSellerProductReviews,
  createReviewReply,
  updateReviewReply,
  deleteReviewReply,
} from '@/services/reviewService';
import type { StoreReview, ProductReview, RatingSummary } from '@/types';

export function SellerReviewsPage() {
  const { user } = useAuth();
  const { data: store, loading: storeLoading } = useSellerStore(user?.id ?? null);
  const [tab, setTab] = useState<'store' | 'products'>('store');
  const [storeReviews, setStoreReviews] = useState<StoreReview[]>([]);
  const [productReviews, setProductReviews] = useState<ProductReview[]>([]);
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [editingReply, setEditingReply] = useState<{ replyId: string; reviewId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const storeId = store?.id ?? null;

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const [sum, sReviews, pReviews] = await Promise.all([
        fetchStoreRatingSummary(storeId),
        fetchSellerStoreReviews(storeId),
        fetchSellerProductReviews(storeId),
      ]);
      setSummary(sum);
      setStoreReviews(sReviews);
      setProductReviews(pReviews);
    } catch {
      setError('Unable to load reviews. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReplySubmit = async (e: React.FormEvent, reviewId: string) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingReply) {
        await updateReviewReply(editingReply.replyId, replyBody);
        setSuccessMsg('Your reply has been updated.');
      } else {
        await createReviewReply(reviewId, replyBody);
        setSuccessMsg('Your reply has been posted.');
      }
      setReplyingTo(null);
      setEditingReply(null);
      setReplyBody('');
      await load();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save your reply.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditReply = (reviewId: string, replyId: string, body: string) => {
    setEditingReply({ replyId, reviewId });
    setReplyingTo(reviewId);
    setReplyBody(body);
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm('Delete your reply?')) return;
    try {
      await deleteReviewReply(replyId);
      await load();
      setSuccessMsg('Your reply has been deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setFormError('Could not delete your reply.');
    }
  };

  const startReply = (reviewId: string) => {
    setReplyingTo(reviewId);
    setEditingReply(null);
    setReplyBody('');
  };

  if (storeLoading) {
    return (
      <SellerLayout activePage="reviews">
        <div className="h-64 bg-neutral-100 rounded-xl animate-pulse" />
      </SellerLayout>
    );
  }

  if (!store) {
    return (
      <SellerLayout activePage="reviews">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-sm text-amber-700">You need to create a store before you can see reviews.</p>
        </div>
      </SellerLayout>
    );
  }

  const publishedStoreReviews = storeReviews.filter((r) => r.status === 'published');
  const hiddenStoreReviews = storeReviews.filter((r) => r.status === 'hidden');
  const publishedProductReviews = productReviews.filter((r) => r.status === 'published');
  const hiddenProductReviews = productReviews.filter((r) => r.status === 'hidden');

  return (
    <SellerLayout activePage="reviews">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Reviews</h1>
        <p className="text-sm text-neutral-500">
          Customer feedback for {store.name}. Reply to store reviews and read product feedback.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 mb-4">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-4">
          {successMsg}
        </div>
      )}
      {formError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 mb-4">
          {formError}
        </div>
      )}

      {/* Rating summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-neutral-200 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-neutral-900">
            {(summary?.totalReviews ?? 0) > 0 ? (summary?.avgRating ?? 0).toFixed(1) : '—'}
          </div>
          <StarRating rating={summary?.avgRating ?? 0} size={16} className="justify-center mt-1.5" />
          <p className="text-xs text-neutral-500 mt-1.5">
            {summary?.totalReviews ?? 0} store review{(summary?.totalReviews ?? 0) === 1 ? '' : 's'}
          </p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-neutral-900">{publishedStoreReviews.length}</div>
          <p className="text-xs text-neutral-500 mt-1.5">Published store reviews</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-neutral-900">{publishedProductReviews.length}</div>
          <p className="text-xs text-neutral-500 mt-1.5">Product reviews</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setTab('store')}
          className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${tab === 'store' ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}
        >
          Store Reviews
        </button>
        <button
          onClick={() => setTab('products')}
          className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${tab === 'products' ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}
        >
          Product Reviews
        </button>
      </div>

      {loading ? (
        <div className="h-48 bg-neutral-100 rounded-xl animate-pulse" />
      ) : tab === 'store' ? (
        <div className="space-y-3">
          {publishedStoreReviews.length === 0 && hiddenStoreReviews.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
              <MessageSquare size={28} className="text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">No store reviews yet.</p>
            </div>
          ) : (
            <>
              {publishedStoreReviews.map((review) => (
                <div key={review.id} className="bg-white border border-neutral-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900">
                          {review.reviewer_profile?.full_name || 'Customer'}
                        </span>
                        {review.is_verified_purchase && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                            <ShieldCheck size={11} /> Verified
                          </span>
                        )}
                        {review.status === 'hidden' && (
                          <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">Hidden</span>
                        )}
                      </div>
                      <StarRating rating={review.rating} size={13} className="mt-1" />
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {new Date(review.created_at).toLocaleDateString('en-ZA', {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </p>
                    </div>
                    {!review.reply && review.status === 'published' && replyingTo !== review.id && (
                      <button
                        onClick={() => startReply(review.id)}
                        className="text-xs font-medium text-neutral-700 border border-neutral-200 px-3 py-1.5 rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-1.5"
                      >
                        <CornerDownRight size={13} /> Reply
                      </button>
                    )}
                  </div>
                  {review.body && <p className="text-sm text-neutral-600 leading-relaxed mt-2">{review.body}</p>}

                  {/* Existing reply */}
                  {review.reply && (
                    <div className="mt-3 ml-4 pl-4 border-l-2 border-neutral-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                          <CornerDownRight size={13} className="text-neutral-400" /> Your reply
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditReply(review.id, review.reply!.id, review.reply!.body)}
                            className="text-neutral-400 hover:text-neutral-700 transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteReply(review.reply!.id)}
                            className="text-neutral-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">{review.reply.body}</p>
                    </div>
                  )}

                  {/* Reply form */}
                  {replyingTo === review.id && (
                    <form onSubmit={(e) => handleReplySubmit(e, review.id)} className="mt-3 bg-neutral-50 border border-neutral-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-neutral-700">
                          {editingReply ? 'Edit your reply' : 'Write a reply'}
                        </span>
                        <button
                          type="button"
                          onClick={() => { setReplyingTo(null); setEditingReply(null); setReplyBody(''); }}
                          className="text-neutral-400 hover:text-neutral-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        rows={2}
                        maxLength={500}
                        required
                        className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 resize-none"
                        placeholder="Thank the customer or address their feedback..."
                      />
                      <button
                        type="submit"
                        disabled={submitting || !replyBody.trim()}
                        className="px-4 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Send size={13} /> {submitting ? 'Saving...' : editingReply ? 'Update Reply' : 'Post Reply'}
                      </button>
                    </form>
                  )}
                </div>
              ))}
              {hiddenStoreReviews.length > 0 && (
                <div className="border-t border-neutral-200 pt-3 mt-3">
                  <p className="text-xs text-neutral-400 mb-2">Hidden by admin (not visible to customers):</p>
                  {hiddenStoreReviews.map((review) => (
                    <div key={review.id} className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 mb-2 opacity-60">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-neutral-700">
                          {review.reviewer_profile?.full_name || 'Customer'}
                        </span>
                        <StarRating rating={review.rating} size={11} />
                      </div>
                      {review.body && <p className="text-xs text-neutral-500 mt-1">{review.body}</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {publishedProductReviews.length === 0 && hiddenProductReviews.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
              <Package size={28} className="text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">No product reviews yet.</p>
            </div>
          ) : (
            <>
              {publishedProductReviews.map((review) => {
                const productName = (review as unknown as { product?: { name?: string } }).product?.name || 'Product';
                return (
                  <div key={review.id} className="bg-white border border-neutral-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Package size={13} className="text-neutral-400" />
                      <span className="text-xs font-medium text-neutral-600">{productName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-neutral-900">
                        {review.reviewer_profile?.full_name || 'Customer'}
                      </span>
                      {review.is_verified_purchase && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                          <ShieldCheck size={11} /> Verified
                        </span>
                      )}
                      {review.status === 'hidden' && (
                        <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">Hidden</span>
                      )}
                    </div>
                    <StarRating rating={review.rating} size={13} className="mt-1" />
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {new Date(review.created_at).toLocaleDateString('en-ZA', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </p>
                    {review.body && <p className="text-sm text-neutral-600 leading-relaxed mt-2">{review.body}</p>}
                  </div>
                );
              })}
              {hiddenProductReviews.length > 0 && (
                <div className="border-t border-neutral-200 pt-3 mt-3">
                  <p className="text-xs text-neutral-400 mb-2">Hidden by admin:</p>
                  {hiddenProductReviews.map((review) => (
                    <div key={review.id} className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 mb-2 opacity-60">
                      <span className="text-xs font-semibold text-neutral-700">
                        {review.reviewer_profile?.full_name || 'Customer'}
                      </span>
                      <StarRating rating={review.rating} size={11} className="mt-0.5" />
                      {review.body && <p className="text-xs text-neutral-500 mt-1">{review.body}</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </SellerLayout>
  );
}
