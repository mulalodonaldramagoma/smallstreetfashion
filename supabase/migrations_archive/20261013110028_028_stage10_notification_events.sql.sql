/*
# Stage 10: WhatsApp Notifications — Schema

Creates a notification_events table that:
- Logs every notification attempt (order, payment, delivery events)
- Has a unique constraint on (event_type, order_id, delivery_id) for idempotency
- Tracks whether each notification was simulated (demo) or actually sent
- Never stores customer phone numbers in the notification log
- Keeps notification status separate from order/payment/delivery status
*/

CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (
    event_type IN (
      'order_confirmation',
      'payment_verified',
      'order_processing',
      'order_dispatched',
      'delivery_in_transit',
      'delivery_out_for_delivery',
      'delivery_delivered',
      'delivery_failed',
      'order_cancelled'
    )
  ),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE CASCADE,
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'simulated', 'failed', 'skipped')),
  is_simulated boolean NOT NULL DEFAULT false,
  template_key text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: one notification per event_type per order (or per delivery for delivery events)
-- This prevents duplicate notifications when webhooks repeat
CREATE UNIQUE INDEX IF NOT EXISTS notification_events_order_event_uk
  ON public.notification_events (event_type, order_id)
  WHERE delivery_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_delivery_event_uk
  ON public.notification_events (event_type, delivery_id)
  WHERE delivery_id IS NOT NULL;

-- Index for querying a customer's notification history via their orders
CREATE INDEX IF NOT EXISTS notification_events_order_id_idx
  ON public.notification_events (order_id);

CREATE INDEX IF NOT EXISTS notification_events_created_at_idx
  ON public.notification_events (created_at DESC);

-- Enable RLS
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

-- Customers can see notifications for their own orders
CREATE POLICY "notification_events_select_own"
  ON public.notification_events FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
  );

-- Sellers can see notifications for orders that contain their products
CREATE POLICY "notification_events_select_seller"
  ON public.notification_events FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT oi.order_id
      FROM public.order_items oi
      JOIN public.stores s ON s.id = oi.store_id
      WHERE s.seller_id = auth.uid()
    )
  );

-- Admins can see all notification events
CREATE POLICY "notification_events_select_admin"
  ON public.notification_events FOR SELECT
  TO authenticated
  USING (private.is_admin());

-- No INSERT/UPDATE/DELETE for clients — only the service role (edge functions) can write
REVOKE INSERT ON public.notification_events FROM authenticated, anon;
REVOKE UPDATE ON public.notification_events FROM authenticated, anon;
REVOKE DELETE ON public.notification_events FROM authenticated, anon;
REVOKE TRUNCATE ON public.notification_events FROM authenticated, anon;

-- Allow service role full access (it bypasses RLS, but be explicit)
GRANT SELECT ON public.notification_events TO authenticated;
