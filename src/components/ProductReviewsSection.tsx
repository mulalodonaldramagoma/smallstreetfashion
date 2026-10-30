import { useState, useEffect, useCallback } from 'react';
import { Star, MessageSquare, Flag, Trash2, Edit2, X, CheckCircle2, ShieldCheck, ImagePlus, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { navigateTo } from '@/hooks/useRouter';
import { StarRating, RatingBreakdown } from '@/components/StarRating';
import { supabase } from '@/lib/supabase';
import {
  fetchProductReviews,
  fetchProductRatingSummary,
  checkCanReviewProduct,
  createProductReview,
  updateProductReview,
  deleteProductReview,
  reportReview,
  uploadReviewPhoto,
  deleteReviewPhoto,
  validateReviewPhoto,
} from '@/services/reviewService';
import type { ProductReview, RatingSummary, ReviewSortOption, ReviewPhoto } from '@/types';

interface ProductReviewsSectionProps {
  productId: string;
}

export function ProductReviewsSection({ productId }: ProductReviewsSectionProps) {
  const { user, profile } = useAuth();
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<ReviewSortOption>('newest');
  const [canReview, setCanReview] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingReview, setEditingReview] = useState<ProductReview | null>(null);
  const [formRating, setFormRating] = useState(5);
  const [formBody, setFormBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, revs] = await Promise.all([
        fetchProductRatingSummary(productId),
        fetchProductReviews(productId, sort),
      ]);
      setSummary(sum);
      setReviews(revs);
      if (user) {
        try {
          const eligible = await checkCanReviewProduct(productId);
          setCanReview(eligible);
        } catch {
          setCanReview(false);
        }
      } else {
        setCanReview(false);
      }
    } catch {
      setError('Unable to load reviews. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [productId, sort, user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formRating < 1 || formRating > 5) {
      setFormError('Please select a rating between 1 and 5 stars.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      let reviewId: string;
      if (editingReview) {
        await updateProductReview(editingReview.id, formRating, formBody);
        reviewId = editingReview.id;
        setSuccessMsg('Your review has been updated.');
      } else {
        await createProductReview(productId, formRating, formBody);
        const { data: created } = await supabase
          .from('product_reviews')
          .select('id')
          .eq('product_id', productId)
          .eq('user_id', user?.id || '')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        reviewId = created?.id || '';
        setSuccessMsg('Your review has been published.');
      }

      if (photoFiles.length > 0 && reviewId && user?.id) {
        setPhotoUploading(true);
        for (const file of photoFiles) {
          try {
            await uploadReviewPhoto(file, user.id, 'product', reviewId);
          } catch (photoErr) {
            const msg = photoErr instanceof Error ? photoErr.message : 'Photo upload failed.';
            setFormError(`Review saved, but: ${msg}`);
          }
        }
        setPhotoUploading(false);
      }

      setShowForm(false);
      setEditingReview(null);
      setFormRating(5);
      setFormBody('');
      setPhotoFiles([]);
      setPhotoError(null);
      await load();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save your review.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
      setPhotoUploading(false);
    }
  };

  const handleEdit = (review: ProductReview) => {
    setEditingReview(review);
    setFormRating(review.rating);
    setFormBody(review.body || '');
    setShowForm(true);
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm('Delete your review? This cannot be undone.')) return;
    try {
      await deleteProductReview(reviewId);
      await load();
      setSuccessMsg('Your review has been deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError('Could not delete your review. Please try again.');
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingId || !reportReason.trim()) return;
    setReportSubmitting(true);
    try {
      await reportReview('product', reportingId, reportReason);
      setReportingId(null);
      setReportReason('');
      setSuccessMsg('Thank you. Your report has been submitted for review.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch {
      setFormError('Could not submit your report. Please try again.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const isOwnReview = (review: ProductReview) => user?.id === review.user_id;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const files = Array.from(e.target.files || []);
    if (photoFiles.length + files.length > 4) {
      setPhotoError('You can add up to 4 photos per review.');
      return;
    }
    for (const f of files) {
      const err = validateReviewPhoto(f);
      if (err) {
        setPhotoError(err);
        return;
      }
    }
    setPhotoFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const removePhotoFile = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeletePhoto = async (photo: ReviewPhoto) => {
    if (!confirm('Remove this photo?')) return;
    setDeletingPhotoId(photo.id);
    try {
      await deleteReviewPhoto(photo.id, photo.storage_path);
      await load();
    } catch {
      setPhotoError('Could not delete the photo. Please try again.');
    } finally {
      setDeletingPhotoId(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-12">
        <div className="h-6 w-40 bg-neutral-100 rounded animate-pulse mb-4" />
        <div className="h-32 bg-neutral-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  const totalReviews = summary?.totalReviews || 0;
  const avgRating = summary?.avgRating || 0;

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold text-neutral-900 mb-6">Customer Reviews</h2>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-700 mb-4 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={load}
            className="px-3 py-1.5 border border-rose-200 text-xs font-medium text-rose-700 rounded-lg hover:bg-rose-100 transition-colors shrink-0"
          >
            Try Again
          </button>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-4">
          {successMsg}
        </div>
      )}

      {/* Summary + breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <div className="bg-white border border-neutral-200 rounded-xl p-5 text-center">
          <div className="text-4xl font-bold text-neutral-900">
            {totalReviews > 0 ? avgRating.toFixed(1) : '—'}
          </div>
          {totalReviews > 0 ? (
            <StarRating rating={avgRating} size={18} className="justify-center mt-2" />
          ) : (
            <div className="mt-2 text-neutral-300 flex justify-center">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={18} fill="currentColor" />
              ))}
            </div>
          )}
          <p className="text-xs text-neutral-500 mt-2">
            {totalReviews > 0 ? `${totalReviews} review${totalReviews === 1 ? '' : 's'}` : 'No reviews yet'}
          </p>
        </div>
        <div className="sm:col-span-2 bg-white border border-neutral-200 rounded-xl p-5">
          {totalReviews > 0 ? (
            <RatingBreakdown distribution={summary?.distribution || {}} totalReviews={totalReviews} />
          ) : (
            <p className="text-sm text-neutral-400 text-center py-4">
              This product hasn't been reviewed yet. Be the first to share your experience.
            </p>
          )}
        </div>
      </div>

      {/* Write a review CTA */}
      {user && profile?.role === 'customer' && !showForm && totalReviews >= 0 && (
        <div className="mb-6">
          {canReview ? (
            <button
              onClick={() => {
                setEditingReview(null);
                setFormRating(5);
                setFormBody('');
                setShowForm(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <MessageSquare size={16} /> Write a Review
            </button>
          ) : (
            <p className="text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              You can review this product after your order has been delivered.{' '}
              <button onClick={() => navigateTo('/products')} className="text-neutral-900 font-medium underline">
                Browse products
              </button>
            </p>
          )}
        </div>
      )}

      {!user && (
        <div className="mb-6 text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg p-3">
          <button onClick={() => navigateTo('/login')} className="text-neutral-900 font-medium underline">
            Sign in
          </button>{' '}
          to write a review after a qualifying purchase.
        </div>
      )}

      {/* Review form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">
              {editingReview ? 'Edit Your Review' : 'Write a Review'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingReview(null);
              }}
              className="text-neutral-400 hover:text-neutral-600"
            >
              <X size={18} />
            </button>
          </div>
          {formError && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-700">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Your Rating</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    size={28}
                    className={star <= formRating ? 'text-amber-400' : 'text-neutral-300'}
                    fill="currentColor"
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Your Review (optional)</label>
            <textarea
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              rows={4}
              maxLength={1000}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
              placeholder="Share details about the product quality, fit, and your experience..."
            />
            <p className="text-xs text-neutral-400 mt-1">{formBody.length}/1000</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Add Photos (optional, up to 4)</label>
            {photoError && (
              <p className="text-xs text-rose-600 mb-2">{photoError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {photoFiles.map((file, index) => (
                <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border border-neutral-200">
                  <img src={URL.createObjectURL(file)} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhotoFile(index)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {photoFiles.length < 4 && (
                <label className="w-20 h-20 border-2 border-dashed border-neutral-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-neutral-400 hover:bg-neutral-50 transition-colors">
                  <ImagePlus size={18} className="text-neutral-400" />
                  <span className="text-[10px] text-neutral-400 mt-1">Add</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-1">JPEG, PNG, or WebP. Max 5 MB each.</p>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editingReview ? 'Update Review' : 'Submit Review'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingReview(null);
              }}
              className="px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Sort controls */}
      {reviews.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-neutral-500">Sort by:</span>
          <button
            onClick={() => setSort('newest')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${sort === 'newest' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
          >
            Newest
          </button>
          <button
            onClick={() => setSort('highest')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${sort === 'highest' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
          >
            Highest Rated
          </button>
        </div>
      )}

      {/* Review list */}
      {reviews.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <MessageSquare size={32} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">
            {totalReviews === 0
              ? 'No reviews have been written for this product yet.'
              : 'No published reviews to display.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white border border-neutral-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-900">
                      {review.reviewer_profile?.full_name || 'Verified Customer'}
                    </span>
                    {review.is_verified_purchase && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        <ShieldCheck size={11} /> Verified Purchase
                      </span>
                    )}
                  </div>
                  <StarRating rating={review.rating} size={14} className="mt-1" />
                  <p className="text-xs text-neutral-400 mt-1">
                    {new Date(review.created_at).toLocaleDateString('en-ZA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isOwnReview(review) && (
                    <>
                      <button
                        onClick={() => handleEdit(review)}
                        className="text-neutral-400 hover:text-neutral-700 transition-colors"
                        title="Edit review"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(review.id)}
                        className="text-neutral-400 hover:text-rose-600 transition-colors"
                        title="Delete review"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                  {!isOwnReview(review) && user && (
                    <button
                      onClick={() => setReportingId(review.id)}
                      className="text-neutral-400 hover:text-amber-600 transition-colors"
                      title="Report review"
                    >
                      <Flag size={15} />
                    </button>
                  )}
                </div>
              </div>
              {review.body && (
                <p className="text-sm text-neutral-600 leading-relaxed mt-2">{review.body}</p>
              )}

              {review.photos && review.photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {review.photos
                    .sort((a, b) => a.position - b.position)
                    .map((photo) => (
                      <div key={photo.id} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-neutral-200">
                        <img
                          src={photo.image_url}
                          alt="Customer photo"
                          loading="lazy"
                          className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setLightboxPhoto(photo.image_url)}
                        />
                        {isOwnReview(review) && (
                          <button
                            onClick={() => handleDeletePhoto(photo)}
                            disabled={deletingPhotoId === photo.id}
                            className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-rose-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                            title="Remove photo"
                          >
                            {deletingPhotoId === photo.id ? <Loader2 size={10} className="animate-spin" /> : <X size={12} />}
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {/* Report form */}
              {reportingId === review.id && (
                <form onSubmit={handleReport} className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <label className="block text-xs font-medium text-amber-800">
                    Why are you reporting this review?
                  </label>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    rows={2}
                    maxLength={500}
                    required
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                    placeholder="e.g. abusive language, spam, fraudulent content..."
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={reportSubmitting || !reportReason.trim()}
                      className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                      {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReportingId(null);
                        setReportReason('');
                      }}
                      className="px-3 py-1.5 text-amber-700 text-xs font-medium hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20"
            onClick={() => setLightboxPhoto(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxPhoto}
            alt="Customer review photo"
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
