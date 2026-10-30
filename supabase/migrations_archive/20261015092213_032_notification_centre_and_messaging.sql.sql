/*
# Notification Centre & Two-Way Messaging

1. New Tables
- `notifications` — in-app notifications for each user (order, payment, delivery, store, product, message, system, account)
- `conversations` — two-way messaging conversations between users
- `conversation_participants` — who is in a conversation (join table)
- `messages` — individual messages within a conversation
- `notification_preferences` — per-user opt-in/out for notification categories

2. Security (RLS)
- Users can access only their own notifications and preferences.
- Users can access conversations and messages only if they are a participant.
- Messages can only be sent by conversation participants (sender_id = auth.uid()).
- Admins can update conversation status and manage participants.
- Notification INSERT is blocked from client — created server-side via edge functions using service role.

3. Functions
- `create_notification()` — idempotent notification creation (called by edge functions with service role).
- `get_unread_notification_count()` — returns unread count for current user.
- `update_conversation_updated_at()` — trigger to sync conversation.updated_at on new messages.
*/

-- ===================== CREATE ALL TABLES FIRST =====================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('order','payment','delivery','store','product','message','system','account')),
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  entity_type text CHECK (entity_type IS NULL OR entity_type IN ('order','product','store','conversation','delivery')),
  entity_id uuid,
  action_url text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general','order_update','promotion','important_notice','system_alert','support')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved')),
  initiated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  related_entity_type text CHECK (related_entity_type IS NULL OR related_entity_type IN ('order','product','store')),
  related_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  order_updates boolean NOT NULL DEFAULT true,
  delivery_updates boolean NOT NULL DEFAULT true,
  payment_updates boolean NOT NULL DEFAULT true,
  messages boolean NOT NULL DEFAULT true,
  store_updates boolean NOT NULL DEFAULT true,
  product_updates boolean NOT NULL DEFAULT true,
  promotions boolean NOT NULL DEFAULT false,
  system_alerts boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===================== INDEXES =====================

CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_id_unread_idx ON notifications(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON conversations(updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS conversation_participants_conv_user_idx ON conversation_participants(conversation_id, user_id);
CREATE INDEX IF NOT EXISTS conversation_participants_user_id_idx ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS messages_conversation_id_created_at_idx ON messages(conversation_id, created_at);

-- ===================== ENABLE RLS ON ALL TABLES =====================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- ===================== NOTIFICATIONS POLICIES =====================

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ===================== CONVERSATIONS POLICIES =====================

DROP POLICY IF EXISTS "conversations_select_participant" ON conversations;
CREATE POLICY "conversations_select_participant"
  ON conversations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "conversations_insert_initiator" ON conversations;
CREATE POLICY "conversations_insert_initiator"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = initiated_by);

DROP POLICY IF EXISTS "conversations_update_admin" ON conversations;
CREATE POLICY "conversations_update_admin"
  ON conversations FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

-- ===================== CONVERSATION PARTICIPANTS POLICIES =====================

DROP POLICY IF EXISTS "cp_select_participant" ON conversation_participants;
CREATE POLICY "cp_select_participant"
  ON conversation_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
      AND cp2.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cp_insert_self_or_admin" ON conversation_participants;
CREATE POLICY "cp_insert_self_or_admin"
  ON conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR private.is_admin()
  );

DROP POLICY IF EXISTS "cp_update_own" ON conversation_participants;
CREATE POLICY "cp_update_own"
  ON conversation_participants FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cp_delete_admin" ON conversation_participants;
CREATE POLICY "cp_delete_admin"
  ON conversation_participants FOR DELETE TO authenticated
  USING (private.is_admin());

-- ===================== MESSAGES POLICIES =====================

DROP POLICY IF EXISTS "messages_select_participant" ON messages;
CREATE POLICY "messages_select_participant"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_insert_participant" ON messages;
CREATE POLICY "messages_insert_participant"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

-- ===================== NOTIFICATION PREFERENCES POLICIES =====================

DROP POLICY IF EXISTS "np_select_own" ON notification_preferences;
CREATE POLICY "np_select_own"
  ON notification_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "np_insert_own" ON notification_preferences;
CREATE POLICY "np_insert_own"
  ON notification_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "np_update_own" ON notification_preferences;
CREATE POLICY "np_update_own"
  ON notification_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ===================== DATABASE FUNCTIONS =====================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_category text,
  p_type text,
  p_title text,
  p_body text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_action_url text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_id uuid;
  new_id uuid;
BEGIN
  SELECT id INTO existing_id
  FROM notifications
  WHERE user_id = p_user_id
    AND type = p_type
    AND (entity_type IS NOT DISTINCT FROM p_entity_type)
    AND (entity_id IS NOT DISTINCT FROM p_entity_id)
    AND created_at > now() - interval '5 minutes'
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO notifications (user_id, category, type, title, body, entity_type, entity_id, action_url)
  VALUES (p_user_id, p_category, p_type, p_title, p_body, p_entity_type, p_entity_id, p_action_url)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_notification FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::integer FROM notifications
  WHERE user_id = auth.uid() AND is_read = false;
$$;

REVOKE EXECUTE ON FUNCTION public.get_unread_notification_count FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count TO authenticated;

CREATE OR REPLACE FUNCTION public.update_conversation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_update_conversation_updated_at ON messages;
CREATE TRIGGER messages_update_conversation_updated_at
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_updated_at();
