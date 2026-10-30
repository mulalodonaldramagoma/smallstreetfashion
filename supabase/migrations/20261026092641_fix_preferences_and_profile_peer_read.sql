-- 1. Fix preferences: default user_id to the authenticated user
ALTER TABLE notification_preferences
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 2. Let conversation participants read each other's profile (name)
DROP POLICY IF EXISTS "profiles_select_conversation_peer" ON profiles;
CREATE POLICY "profiles_select_conversation_peer"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM conversation_participants cp
    WHERE cp.user_id = profiles.id
      AND EXISTS (
        SELECT 1
        FROM conversation_participants me
        WHERE me.user_id = auth.uid()
          AND me.conversation_id = cp.conversation_id
      )
  )
);