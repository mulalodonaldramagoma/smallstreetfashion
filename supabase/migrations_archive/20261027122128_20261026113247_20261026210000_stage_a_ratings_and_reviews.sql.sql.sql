-- Stage A: Product and Store Ratings & Reviews (Batch 5)
-- Creates review tables, eligibility functions, RLS policies, admin moderation,
-- and column-level privileges. Combines canonical migrations 1-4 with all
-- privilege fixes incorporated directly (no broken intermediate states).

-- ============================================================
-- 1. product_reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body text,
  is_verified_purchase boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','pending','hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status ON public.product_reviews(product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user ON public.product_reviews(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_reviews_unique_order_item_user ON public.product_reviews(order_item_id, user_id);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. store_reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS public.store_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body text,
  is_verified_purchase boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','pending','hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_reviews_store_status ON public.store_reviews(store_id, status);
CREATE INDEX IF NOT EXISTS idx_store_reviews_user ON public.store_reviews(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_reviews_unique_store_order_user ON public.store_reviews(store_id, order_id, user_id);

ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. review_replies
-- ============================================================
CREATE TABLE IF NOT EXISTS public.review_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_review_id uuid NOT NULL REFERENCES public.store_reviews(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_replies_one_per_review ON public.review_replies(store_review_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_seller ON public.review_replies(seller_id);

ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. review_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_type text NOT NULL CHECK (review_type IN ('product','store')),
  review_id uuid NOT NULL,
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_review_reports_status ON public.review_reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_review_reports_review ON public.review_reports(review_type, review_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_reports_unique ON public.review_reports(review_type, review_id, reporter_id);

ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. Eligibility helper functions (SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_review_product(p_user_id uuid, p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    INNER JOIN public.orders o ON o.id = oi.order_id
    LEFT JOIN public.deliveries d ON d.order_id = o.id
    WHERE oi.product_id = p_product_id
      AND o.user_id = p_user_id
      AND o.status IN ('paid','refunded','partially_refunded')
      AND d.status IN ('delivered','ready_for_collection')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_review_store(p_user_id uuid, p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    INNER JOIN public.orders o ON o.id = oi.order_id
    LEFT JOIN public.deliveries d ON d.order_id = o.id
    WHERE oi.store_id = p_store_id
      AND o.user_id = p_user_id
      AND o.status IN ('paid','refunded','partially_refunded')
      AND d.status IN ('delivered','ready_for_collection')
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_product(p_user_id uuid, p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.products p
    INNER JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = p_product_id
      AND s.seller_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_store(p_user_id uuid, p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = p_store_id AND s.seller_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_qualifying_order_item(p_user_id uuid, p_product_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT oi.id
  FROM public.order_items oi
  INNER JOIN public.orders o ON o.id = oi.order_id
  LEFT JOIN public.deliveries d ON d.order_id = o.id
  WHERE oi.product_id = p_product_id
    AND o.user_id = p_user_id
    AND o.status IN ('paid','refunded','partially_refunded')
    AND d.status IN ('delivered','ready_for_collection')
  ORDER BY oi.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_qualifying_store_order(p_user_id uuid, p_store_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.id
  FROM public.order_items oi
  INNER JOIN public.orders o ON o.id = oi.order_id
  LEFT JOIN public.deliveries d ON d.order_id = o.id
  WHERE oi.store_id = p_store_id
    AND o.user_id = p_user_id
    AND o.status IN ('paid','refunded','partially_refunded')
    AND d.status IN ('delivered','ready_for_collection')
  ORDER BY o.created_at DESC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.can_review_product(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_review_product(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_review_store(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_review_store(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owns_product(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_product(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owns_store(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_store(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_qualifying_order_item(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_qualifying_order_item(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_qualifying_store_order(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_qualifying_store_order(uuid, uuid) TO authenticated;

-- ============================================================
-- 6. Rating aggregate functions (SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_product_rating_summary(p_product_id uuid)
RETURNS TABLE (avg_rating numeric, total_reviews bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(AVG(pr.rating), 0)::numeric(3,2) AS avg_rating,
    COUNT(*)::bigint AS total_reviews
  FROM public.product_reviews pr
  WHERE pr.product_id = p_product_id
    AND pr.status = 'published';
$$;

CREATE OR REPLACE FUNCTION public.get_store_rating_summary(p_store_id uuid)
RETURNS TABLE (avg_rating numeric, total_reviews bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(AVG(sr.rating), 0)::numeric(3,2) AS avg_rating,
    COUNT(*)::bigint AS total_reviews
  FROM public.store_reviews sr
  WHERE sr.store_id = p_store_id
    AND sr.status = 'published';
$$;

CREATE OR REPLACE FUNCTION public.get_product_rating_dist(p_product_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_object_agg(rating, cnt), '{}'::jsonb)
  FROM (
    SELECT pr.rating, COUNT(*)::int AS cnt
    FROM public.product_reviews pr
    WHERE pr.product_id = p_product_id AND pr.status = 'published'
    GROUP BY pr.rating
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.get_store_rating_dist(p_store_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_object_agg(rating, cnt), '{}'::jsonb)
  FROM (
    SELECT sr.rating, COUNT(*)::int AS cnt
    FROM public.store_reviews sr
    WHERE sr.store_id = p_store_id AND sr.status = 'published'
    GROUP BY sr.rating
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_rating_summary(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_rating_summary(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_rating_dist(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_rating_dist(uuid) TO anon, authenticated;

-- ============================================================
-- 7. RLS Policies — product_reviews
-- ============================================================

DROP POLICY IF EXISTS "read_published_product_reviews" ON public.product_reviews;
CREATE POLICY "read_published_product_reviews"
  ON public.product_reviews FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "insert_own_product_review" ON public.product_reviews;
CREATE POLICY "insert_own_product_review"
  ON public.product_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_review_product(auth.uid(), product_id)
    AND NOT public.owns_product(auth.uid(), product_id)
    AND order_item_id = public.get_qualifying_order_item(auth.uid(), product_id)
  );

DROP POLICY IF EXISTS "update_own_product_review" ON public.product_reviews;
CREATE POLICY "update_own_product_review"
  ON public.product_reviews FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_product_review" ON public.product_reviews;
CREATE POLICY "delete_own_product_review"
  ON public.product_reviews FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_all_product_reviews" ON public.product_reviews;
CREATE POLICY "admin_all_product_reviews"
  ON public.product_reviews FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

-- ============================================================
-- 8. RLS Policies — store_reviews
-- ============================================================

DROP POLICY IF EXISTS "read_published_store_reviews" ON public.store_reviews;
CREATE POLICY "read_published_store_reviews"
  ON public.store_reviews FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "seller_read_store_reviews" ON public.store_reviews;
CREATE POLICY "seller_read_store_reviews"
  ON public.store_reviews FOR SELECT
  TO authenticated
  USING (public.owns_store(auth.uid(), store_id));

DROP POLICY IF EXISTS "insert_own_store_review" ON public.store_reviews;
CREATE POLICY "insert_own_store_review"
  ON public.store_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_review_store(auth.uid(), store_id)
    AND NOT public.owns_store(auth.uid(), store_id)
    AND order_id = public.get_qualifying_store_order(auth.uid(), store_id)
  );

DROP POLICY IF EXISTS "update_own_store_review" ON public.store_reviews;
CREATE POLICY "update_own_store_review"
  ON public.store_reviews FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_store_review" ON public.store_reviews;
CREATE POLICY "delete_own_store_review"
  ON public.store_reviews FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_read_store_reviews" ON public.store_reviews;
CREATE POLICY "admin_read_store_reviews"
  ON public.store_reviews FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

-- ============================================================
-- 9. RLS Policies — review_replies
-- ============================================================

DROP POLICY IF EXISTS "read_published_replies" ON public.review_replies;
CREATE POLICY "read_published_replies"
  ON public.review_replies FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.store_reviews sr
      WHERE sr.id = review_replies.store_review_id AND sr.status = 'published'
    )
  );

DROP POLICY IF EXISTS "seller_insert_reply" ON public.review_replies;
CREATE POLICY "seller_insert_reply"
  ON public.review_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    seller_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.store_reviews sr
      INNER JOIN public.stores s ON s.id = sr.store_id
      WHERE sr.id = review_replies.store_review_id
        AND s.seller_id = auth.uid()
        AND sr.status = 'published'
    )
  );

DROP POLICY IF EXISTS "seller_update_own_reply" ON public.review_replies;
CREATE POLICY "seller_update_own_reply"
  ON public.review_replies FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "seller_delete_own_reply" ON public.review_replies;
CREATE POLICY "seller_delete_own_reply"
  ON public.review_replies FOR DELETE
  TO authenticated
  USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "admin_read_replies" ON public.review_replies;
CREATE POLICY "admin_read_replies"
  ON public.review_replies FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

-- ============================================================
-- 10. RLS Policies — review_reports
-- ============================================================

DROP POLICY IF EXISTS "read_own_reports" ON public.review_reports;
CREATE POLICY "read_own_reports"
  ON public.review_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_report" ON public.review_reports;
CREATE POLICY "insert_own_report"
  ON public.review_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND (
      (review_type = 'product' AND EXISTS (SELECT 1 FROM public.product_reviews WHERE id = review_id))
      OR (review_type = 'store' AND EXISTS (SELECT 1 FROM public.store_reviews WHERE id = review_id))
    )
  );

DROP POLICY IF EXISTS "admin_read_reports" ON public.review_reports;
CREATE POLICY "admin_read_reports"
  ON public.review_reports FOR SELECT
  TO authenticated
  USING (public.is_current_admin());

DROP POLICY IF EXISTS "admin_update_reports" ON public.review_reports;
CREATE POLICY "admin_update_reports"
  ON public.review_reports FOR UPDATE
  TO authenticated
  USING (public.is_current_admin())
  WITH CHECK (public.is_current_admin());

-- ============================================================
-- 11. Admin moderation functions (SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_set_review_status(
  p_review_type text,
  p_review_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_current_admin() THEN
    RAISE EXCEPTION 'Only admins can moderate reviews';
  END IF;
  IF p_status NOT IN ('published','pending','hidden') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  IF p_review_type = 'product' THEN
    UPDATE public.product_reviews SET status = p_status, updated_at = now() WHERE id = p_review_id;
  ELSIF p_review_type = 'store' THEN
    UPDATE public.store_reviews SET status = p_status, updated_at = now() WHERE id = p_review_id;
  ELSE
    RAISE EXCEPTION 'Invalid review type';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_review_status(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_review_status(text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  p_report_id uuid,
  p_status text,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_current_admin() THEN
    RAISE EXCEPTION 'Only admins can resolve reports';
  END IF;
  IF p_status NOT IN ('resolved','dismissed') THEN
    RAISE EXCEPTION 'Invalid report status';
  END IF;
  UPDATE public.review_reports
  SET status = p_status,
      resolution_note = p_note,
      resolved_by = auth.uid(),
      resolved_at = now()
  WHERE id = p_report_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) TO authenticated;

-- ============================================================
-- 12. Table-level privileges (defense in depth)
-- ============================================================

-- product_reviews: anon gets SELECT only; authenticated gets SELECT + INSERT + DELETE
-- UPDATE restricted to rating, body, updated_at via column-level grants
REVOKE TRUNCATE ON public.product_reviews FROM anon, authenticated;
REVOKE UPDATE ON public.product_reviews FROM anon;
REVOKE DELETE ON public.product_reviews FROM anon;
REVOKE INSERT ON public.product_reviews FROM anon;
REVOKE UPDATE ON public.product_reviews FROM authenticated;
GRANT UPDATE (rating, body, updated_at) ON public.product_reviews TO authenticated;

-- store_reviews: same pattern
REVOKE TRUNCATE ON public.store_reviews FROM anon, authenticated;
REVOKE UPDATE ON public.store_reviews FROM anon;
REVOKE DELETE ON public.store_reviews FROM anon;
REVOKE INSERT ON public.store_reviews FROM anon;
REVOKE UPDATE ON public.store_reviews FROM authenticated;
GRANT UPDATE (rating, body, updated_at) ON public.store_reviews TO authenticated;

-- review_replies: anon gets SELECT only; authenticated gets SELECT + INSERT + DELETE
-- UPDATE restricted to body, updated_at
REVOKE TRUNCATE ON public.review_replies FROM anon, authenticated;
REVOKE UPDATE ON public.review_replies FROM anon;
REVOKE DELETE ON public.review_replies FROM anon;
REVOKE INSERT ON public.review_replies FROM anon;
REVOKE UPDATE ON public.review_replies FROM authenticated;
GRANT UPDATE (body, updated_at) ON public.review_replies TO authenticated;

-- review_reports: no direct UPDATE for any client role (admin uses SECURITY DEFINER fn)
REVOKE TRUNCATE ON public.review_reports FROM anon, authenticated;
REVOKE UPDATE ON public.review_reports FROM anon;
REVOKE UPDATE ON public.review_reports FROM authenticated;
REVOKE DELETE ON public.review_reports FROM anon;
REVOKE INSERT ON public.review_reports FROM anon;

-- Grant SELECT on all review tables to anon and authenticated
GRANT SELECT ON public.product_reviews TO anon, authenticated;
GRANT SELECT ON public.store_reviews TO anon, authenticated;
GRANT SELECT ON public.review_replies TO anon, authenticated;
GRANT SELECT ON public.review_reports TO authenticated;

-- Grant INSERT/DELETE where RLS policies allow
GRANT INSERT ON public.product_reviews TO authenticated;
GRANT DELETE ON public.product_reviews TO authenticated;
GRANT INSERT ON public.store_reviews TO authenticated;
GRANT DELETE ON public.store_reviews TO authenticated;
GRANT INSERT ON public.review_replies TO authenticated;
GRANT DELETE ON public.review_replies TO authenticated;
GRANT INSERT ON public.review_reports TO authenticated;