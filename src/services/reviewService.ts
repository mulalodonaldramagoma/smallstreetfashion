import { supabase } from '@/lib/supabase';
import type {
  ProductReview,
  StoreReview,
  ReviewReply,
  ReviewReport,
  ReviewPhoto,
  RatingSummary,
  ReviewSortOption,
  ReviewType,
} from '@/types';

// --- Rating summaries (public, uses SECURITY DEFINER functions) ---

export async function fetchProductRatingSummary(productId: string): Promise<RatingSummary> {
  const { data, error } = await supabase
    .rpc('get_product_rating_summary', { p_product_id: productId })
    .maybeSingle();
  if (error) throw error;

  const { data: distData, error: distError } = await supabase.rpc('get_product_rating_dist', {
    p_product_id: productId,
  });
  if (distError) throw distError;

  const row = (data || { avg_rating: 0, total_reviews: 0 }) as {
    avg_rating: number;
    total_reviews: number;
  };
  return {
    avgRating: Number(row.avg_rating) || 0,
    totalReviews: Number(row.total_reviews) || 0,
    distribution: (distData as Record<string, number>) || {},
  };
}

export async function fetchStoreRatingSummary(storeId: string): Promise<RatingSummary> {
  const { data, error } = await supabase
    .rpc('get_store_rating_summary', { p_store_id: storeId })
    .maybeSingle();
  if (error) throw error;

  const { data: distData, error: distError } = await supabase.rpc('get_store_rating_dist', {
    p_store_id: storeId,
  });
  if (distError) throw distError;

  const row = (data || { avg_rating: 0, total_reviews: 0 }) as {
    avg_rating: number;
    total_reviews: number;
  };
  return {
    avgRating: Number(row.avg_rating) || 0,
    totalReviews: Number(row.total_reviews) || 0,
    distribution: (distData as Record<string, number>) || {},
  };
}

// --- Batch rating summaries (for product cards on listing pages) ---

export async function fetchProductRatingSummaries(
  productIds: string[]
): Promise<Record<string, RatingSummary>> {
  if (productIds.length === 0) return {};
  const results: Record<string, RatingSummary> = {};
  await Promise.all(
    productIds.map(async (id) => {
      try {
        results[id] = await fetchProductRatingSummary(id);
      } catch {
        results[id] = { avgRating: 0, totalReviews: 0, distribution: {} };
      }
    })
  );
  return results;
}

// --- Eligibility checks ---

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? '';
}

export async function checkCanReviewProduct(productId: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;
  const { data, error } = await supabase.rpc('can_review_product', {
    p_user_id: userId,
    p_product_id: productId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function checkCanReviewStore(storeId: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;
  const { data, error } = await supabase.rpc('can_review_store', {
    p_user_id: userId,
    p_store_id: storeId,
  });
  if (error) throw error;
  return Boolean(data);
}

// --- Product reviews ---

export async function fetchProductReviews(
  productId: string,
  sort: ReviewSortOption = 'newest'
): Promise<ProductReview[]> {
  let query = supabase
    .from('product_reviews')
    .select(
      '*, reviewer_profile:profiles!product_reviews_user_id_profiles_fkey(id, full_name), photos:review_photos(id, image_url, position, storage_path)'
    )
    .eq('product_id', productId)
    .eq('status', 'published');

  if (sort === 'highest') {
    query = query.order('rating', { ascending: false }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as ProductReview[];
}

export async function fetchMyProductReview(productId: string): Promise<ProductReview | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('product_reviews')
    .select('*')
    .eq('product_id', productId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as ProductReview | null;
}

export async function createProductReview(
  productId: string,
  rating: number,
  body: string | null
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('You must be signed in to review a product.');
  const { data: orderItemId, error: itemError } = await supabase.rpc(
    'get_qualifying_order_item',
    { p_user_id: userId, p_product_id: productId }
  );
  if (itemError) throw itemError;
  if (!orderItemId) throw new Error('You are not eligible to review this product.');

  const { error } = await supabase.from('product_reviews').insert({
    product_id: productId,
    order_item_id: orderItemId as string,
    rating,
    body: body?.trim() || null,
  });
  if (error) throw error;
}

export async function updateProductReview(
  reviewId: string,
  rating: number,
  body: string | null
): Promise<void> {
  const { error } = await supabase
    .from('product_reviews')
    .update({ rating, body: body?.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', reviewId);
  if (error) throw error;
}

export async function deleteProductReview(reviewId: string): Promise<void> {
  const { error } = await supabase.from('product_reviews').delete().eq('id', reviewId);
  if (error) throw error;
}

// --- Store reviews ---

export async function fetchStoreReviews(
  storeId: string,
  sort: ReviewSortOption = 'newest'
): Promise<StoreReview[]> {
  let query = supabase
    .from('store_reviews')
    .select(
      '*, reviewer_profile:profiles!store_reviews_user_id_profiles_fkey(id, full_name), reply:review_replies(*), photos:review_photos(id, image_url, position, storage_path)'
    )
    .eq('store_id', storeId)
    .eq('status', 'published');

  if (sort === 'highest') {
    query = query.order('rating', { ascending: false }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as StoreReview[];
}

export async function createStoreReview(
  storeId: string,
  rating: number,
  body: string | null
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('You must be signed in to review a store.');
  const { data: orderId, error: orderError } = await supabase.rpc(
    'get_qualifying_store_order',
    { p_user_id: userId, p_store_id: storeId }
  );
  if (orderError) throw orderError;
  if (!orderId) throw new Error('You are not eligible to review this store.');

  const { error } = await supabase.from('store_reviews').insert({
    store_id: storeId,
    order_id: orderId as string,
    rating,
    body: body?.trim() || null,
  });
  if (error) throw error;
}

export async function updateStoreReview(
  reviewId: string,
  rating: number,
  body: string | null
): Promise<void> {
  const { error } = await supabase
    .from('store_reviews')
    .update({ rating, body: body?.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', reviewId);
  if (error) throw error;
}

export async function deleteStoreReview(reviewId: string): Promise<void> {
  const { error } = await supabase.from('store_reviews').delete().eq('id', reviewId);
  if (error) throw error;
}

// --- Seller replies ---

export async function createReviewReply(
  storeReviewId: string,
  body: string
): Promise<void> {
  const { error } = await supabase.from('review_replies').insert({
    store_review_id: storeReviewId,
    body: body.trim(),
  });
  if (error) throw error;
}

export async function updateReviewReply(replyId: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('review_replies')
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq('id', replyId);
  if (error) throw error;
}

export async function deleteReviewReply(replyId: string): Promise<void> {
  const { error } = await supabase.from('review_replies').delete().eq('id', replyId);
  if (error) throw error;
}

// --- Reports ---

export async function reportReview(
  reviewType: ReviewType,
  reviewId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.from('review_reports').insert({
    review_type: reviewType,
    review_id: reviewId,
    reason: reason.trim(),
  });
  if (error) throw error;
}

// --- Seller dashboard: reviews for own store ---

export async function fetchSellerStoreReviews(storeId: string): Promise<StoreReview[]> {
  const { data, error } = await supabase
    .from('store_reviews')
    .select(
      '*, reviewer_profile:profiles!store_reviews_user_id_profiles_fkey(id, full_name), reply:review_replies(*)'
    )
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as StoreReview[];
}

export async function fetchSellerProductReviews(storeId: string): Promise<ProductReview[]> {
  const { data, error } = await supabase
    .from('product_reviews')
    .select(
      '*, reviewer_profile:profiles!product_reviews_user_id_profiles_fkey(id, full_name), product:products!inner(id, name, store_id)'
    )
    .eq('product.store_id', storeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as ProductReview[];
}

// --- Admin moderation ---

export async function fetchAdminReportedReviews(): Promise<
  (ReviewReport & {
    review_data?: ProductReview | StoreReview | null;
  })[]
> {
  const { data: reports, error } = await supabase
    .from('review_reports')
    .select(
      '*, reporter_profile:profiles!review_reports_reporter_id_profiles_fkey(id, full_name)'
    )
    .order('created_at', { ascending: false });
  if (error) throw error;

  const reportList = (reports || []) as unknown as ReviewReport[];

  const result: (ReviewReport & {
    review_data?: ProductReview | StoreReview | null;
  })[] = [];

  for (const report of reportList) {
    let reviewData: ProductReview | StoreReview | null = null;
    if (report.review_type === 'product') {
      const { data } = await supabase
        .from('product_reviews')
        .select(
          '*, reviewer_profile:profiles!product_reviews_user_id_profiles_fkey(id, full_name)'
        )
        .eq('id', report.review_id)
        .maybeSingle();
      reviewData = data as unknown as ProductReview | null;
    } else {
      const { data } = await supabase
        .from('store_reviews')
        .select(
          '*, reviewer_profile:profiles!store_reviews_user_id_profiles_fkey(id, full_name)'
        )
        .eq('id', report.review_id)
        .maybeSingle();
      reviewData = data as unknown as StoreReview | null;
    }
    result.push({ ...report, review_data: reviewData });
  }

  return result;
}

export async function adminSetReviewStatus(
  reviewType: ReviewType,
  reviewId: string,
  status: 'published' | 'hidden'
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_review_status', {
    p_review_type: reviewType,
    p_review_id: reviewId,
    p_status: status,
  });
  if (error) throw error;
}

export async function adminResolveReport(
  reportId: string,
  status: 'resolved' | 'dismissed',
  note: string
): Promise<void> {
  const { error } = await supabase.rpc('admin_resolve_report', {
    p_report_id: reportId,
    p_status: status,
    p_note: note,
  });
  if (error) throw error;
}

export async function fetchAllProductReviewsAdmin(): Promise<ProductReview[]> {
  const { data, error } = await supabase
    .from('product_reviews')
    .select(
      '*, reviewer_profile:profiles!product_reviews_user_id_profiles_fkey(id, full_name), product:products(id, name)'
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as ProductReview[];
}

export async function fetchAllStoreReviewsAdmin(): Promise<StoreReview[]> {
  const { data, error } = await supabase
    .from('store_reviews')
    .select(
      '*, reviewer_profile:profiles!store_reviews_user_id_profiles_fkey(id, full_name), store:stores(id, name)'
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as StoreReview[];
}

// --- Review photos ---

const ALLOWED_REVIEW_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_REVIEW_PHOTO_SIZE = 5 * 1024 * 1024;
const MAX_REVIEW_PHOTOS = 4;

export function validateReviewPhoto(file: File): string | null {
  if (!ALLOWED_REVIEW_PHOTO_TYPES.includes(file.type)) {
    return 'Photos must be JPEG, PNG, or WebP.';
  }
  if (file.size > MAX_REVIEW_PHOTO_SIZE) {
    return 'Each photo must be 5 MB or smaller.';
  }
  return null;
}

export async function uploadReviewPhoto(
  file: File,
  userId: string,
  reviewType: ReviewType,
  reviewId: string
): Promise<ReviewPhoto> {
  const validationError = validateReviewPhoto(file);
  if (validationError) throw new Error(validationError);

  const { count, error: countError } = await supabase
    .from('review_photos')
    .select('id', { count: 'exact', head: true })
    .eq(reviewType === 'product' ? 'product_review_id' : 'store_review_id', reviewId)
    .eq('user_id', userId);
  if (countError) throw countError;
  if ((count ?? 0) >= MAX_REVIEW_PHOTOS) {
    throw new Error(`You can add up to ${MAX_REVIEW_PHOTOS} photos per review.`);
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${userId}/${reviewType}-${reviewId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('review-photos')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('review-photos')
    .getPublicUrl(fileName);

  const { data: photoRow, error: insertError } = await supabase
    .from('review_photos')
    .insert({
      product_review_id: reviewType === 'product' ? reviewId : null,
      store_review_id: reviewType === 'store' ? reviewId : null,
      user_id: userId,
      storage_path: fileName,
      image_url: urlData.publicUrl,
      position: count ?? 0,
    })
    .select('*')
    .single();
  if (insertError) {
    await supabase.storage.from('review-photos').remove([fileName]);
    throw insertError;
  }
  return photoRow as ReviewPhoto;
}

export async function deleteReviewPhoto(
  photoId: string,
  storagePath: string
): Promise<void> {
  const { error: deleteError } = await supabase.storage
    .from('review-photos')
    .remove([storagePath]);
  if (deleteError) throw deleteError;

  const { error } = await supabase.from('review_photos').delete().eq('id', photoId);
  if (error) throw error;
}
