import { useState, useEffect, useCallback } from 'react';
import { Flag, Star, Eye, EyeOff, CheckCircle2, XCircle, ShieldCheck, MessageSquare } from 'lucide-react';
import { AdminLayout } from '@/components/AdminLayout';
import { StarRating } from '@/components/StarRating';
import {
  fetchAdminReportedReviews,
  adminSetReviewStatus,
  adminResolveReport,
  fetchAllProductReviewsAdmin,
  fetchAllStoreReviewsAdmin,
} from '@/services/reviewService';
import type { ProductReview, StoreReview, ReviewReport, ReviewType } from '@/types';

type ReportedItem = ReviewReport & {
  review_data?: ProductReview | StoreReview | null;
};

export function AdminReviewsPage() {
  const [tab, setTab] = useState<'reports' | 'product' | 'store'>('reports');
  const [reports, setReports] = useState<ReportedItem[]>([]);
  const [productReviews, setProductReviews] = useState<ProductReview[]>([]);
  const [storeReviews, setStoreReviews] = useState<StoreReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'reports') {
        const data = await fetchAdminReportedReviews();
        setReports(data);
      } else if (tab === 'product') {
        const data = await fetchAllProductReviewsAdmin();
        setProductReviews(data);
      } else {
        const data = await fetchAllStoreReviewsAdmin();
        setStoreReviews(data);
      }
    } catch {
      setError('Unable to load reviews. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSetStatus = async (reviewType: ReviewType, reviewId: string, status: 'published' | 'hidden') => {
    setActionError(null);
    try {
      await adminSetReviewStatus(reviewType, reviewId, status);
      setSuccessMsg(`Review ${status === 'hidden' ? 'hidden' : 'restored'} successfully.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not update review status.';
      setActionError(msg);
    }
  };

  const handleResolve = async (e: React.SyntheticEvent, reportId: string, status: 'resolved' | 'dismissed') => {
    e.preventDefault();
    setActionError(null);
    try {
      await adminResolveReport(reportId, status, resolveNote);
      setResolvingId(null);
      setResolveNote('');
      setSuccessMsg(`Report ${status}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not resolve report.';
      setActionError(msg);
    }
  };

  return (
    <AdminLayout activePage="reviews">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Review Moderation</h1>
        <p className="text-sm text-neutral-500">Manage reported reviews and moderate content.</p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 mb-4">
          {error}
        </div>
      )}
      {actionError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 mb-4">
          {actionError}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-4">
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setTab('reports')}
          className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${tab === 'reports' ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}
        >
          <Flag size={14} className="inline mr-1.5" />
          Reports ({reports.filter((r) => r.status === 'open').length})
        </button>
        <button
          onClick={() => setTab('product')}
          className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${tab === 'product' ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}
        >
          Product Reviews
        </button>
        <button
          onClick={() => setTab('store')}
          className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${tab === 'store' ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}
        >
          Store Reviews
        </button>
      </div>

      {loading ? (
        <div className="h-48 bg-neutral-100 rounded-xl animate-pulse" />
      ) : tab === 'reports' ? (
        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
              <Flag size={28} className="text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">No reports have been submitted.</p>
            </div>
          ) : (
            reports.map((report) => {
              const review = report.review_data;
              return (
                <div key={report.id} className="bg-white border border-neutral-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        report.status === 'open' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        report.status === 'resolved' ? 'bg-green-50 text-green-700 border border-green-200' :
                        'bg-neutral-100 text-neutral-600'
                      }`}>
                        {report.status}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {report.review_type} review
                      </span>
                    </div>
                    <span className="text-xs text-neutral-400">
                      {new Date(report.created_at).toLocaleDateString('en-ZA', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="bg-neutral-50 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-neutral-900">
                        {review?.reviewer_profile?.full_name || 'Customer'}
                      </span>
                      {review?.is_verified_purchase && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                          <ShieldCheck size={11} /> Verified
                        </span>
                      )}
                      {review && <StarRating rating={review.rating} size={12} className="ml-1" />}
                    </div>
                    {review?.body && <p className="text-sm text-neutral-600 mt-1.5">{review.body}</p>}
                    {review?.status === 'hidden' && (
                      <p className="text-xs text-neutral-400 mt-1">This review is currently hidden.</p>
                    )}
                  </div>

                  <div className="text-sm">
                    <span className="text-xs font-medium text-neutral-500">Report reason:</span>
                    <p className="text-sm text-neutral-700 mt-0.5">{report.reason}</p>
                  </div>

                  {report.status === 'open' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleSetStatus(report.review_type, report.review_id, 'hidden')}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
                      >
                        <EyeOff size={13} /> Hide Review
                      </button>
                      <button
                        onClick={() => handleSetStatus(report.review_type, report.review_id, 'published')}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
                      >
                        <Eye size={13} /> Keep Published
                      </button>
                      {resolvingId === report.id ? (
                        <form onSubmit={(e) => handleResolve(e, report.id, 'resolved')} className="flex items-center gap-2 w-full mt-2">
                          <input
                            type="text"
                            value={resolveNote}
                            onChange={(e) => setResolveNote(e.target.value)}
                            maxLength={300}
                            placeholder="Resolution note (optional)"
                            className="flex-1 px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                          />
                          <button type="submit" className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                            <CheckCircle2 size={13} /> Resolve
                          </button>
                          <button type="button" onClick={(e) => handleResolve(e, report.id, 'dismissed')} className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-neutral-100 text-neutral-600 rounded-lg hover:bg-neutral-200 transition-colors">
                            <XCircle size={13} /> Dismiss
                          </button>
                          <button type="button" onClick={() => { setResolvingId(null); setResolveNote(''); }} className="text-xs text-neutral-500 hover:underline">
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          onClick={() => setResolvingId(report.id)}
                          className="text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:underline"
                        >
                          Mark resolved
                        </button>
                      )}
                    </div>
                  )}
                  {report.status !== 'open' && report.resolution_note && (
                    <p className="text-xs text-neutral-500 mt-2 italic">Resolution: {report.resolution_note}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : tab === 'product' ? (
        <div className="space-y-3">
          {productReviews.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
              <MessageSquare size={28} className="text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">No product reviews exist.</p>
            </div>
          ) : (
            productReviews.map((review) => {
              const productName = (review as unknown as { product?: { name?: string } }).product?.name || 'Product';
              return (
                <div key={review.id} className="bg-white border border-neutral-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900">
                          {review.reviewer_profile?.full_name || 'Customer'}
                        </span>
                        <span className="text-xs text-neutral-400">on {productName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          review.status === 'published' ? 'bg-green-50 text-green-700' :
                          review.status === 'hidden' ? 'bg-rose-50 text-rose-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>{review.status}</span>
                      </div>
                      <StarRating rating={review.rating} size={13} className="mt-1" />
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {new Date(review.created_at).toLocaleDateString('en-ZA')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {review.status === 'published' ? (
                        <button
                          onClick={() => handleSetStatus('product', review.id, 'hidden')}
                          className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 transition-colors"
                        >
                          <EyeOff size={13} /> Hide
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSetStatus('product', review.id, 'published')}
                          className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <Eye size={13} /> Restore
                        </button>
                      )}
                    </div>
                  </div>
                  {review.body && <p className="text-sm text-neutral-600 mt-2">{review.body}</p>}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {storeReviews.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
              <MessageSquare size={28} className="text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">No store reviews exist.</p>
            </div>
          ) : (
            storeReviews.map((review) => {
              const storeName = (review as unknown as { store?: { name?: string } }).store?.name || 'Store';
              return (
                <div key={review.id} className="bg-white border border-neutral-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900">
                          {review.reviewer_profile?.full_name || 'Customer'}
                        </span>
                        <span className="text-xs text-neutral-400">on {storeName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          review.status === 'published' ? 'bg-green-50 text-green-700' :
                          review.status === 'hidden' ? 'bg-rose-50 text-rose-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>{review.status}</span>
                      </div>
                      <StarRating rating={review.rating} size={13} className="mt-1" />
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {new Date(review.created_at).toLocaleDateString('en-ZA')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {review.status === 'published' ? (
                        <button
                          onClick={() => handleSetStatus('store', review.id, 'hidden')}
                          className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 transition-colors"
                        >
                          <EyeOff size={13} /> Hide
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSetStatus('store', review.id, 'published')}
                          className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <Eye size={13} /> Restore
                        </button>
                      )}
                    </div>
                  </div>
                  {review.body && <p className="text-sm text-neutral-600 mt-2">{review.body}</p>}
                </div>
              );
            })
          )}
        </div>
      )}
    </AdminLayout>
  );
}
