/*
# Fix notification preferences saving and messaging profile reads

## Problems
1. **Notification preferences cannot be saved.** The
   `notification_preferences.user_id` column is NOT NULL with no
   default. The frontend upsert omits `user_id` (by design — the
   service strips it out). The INSERT policy
   `np_insert_own` checks `auth.uid() = user_id`, but `user_id` is
   null on insert, so the policy fails and the row is rejected.
   Result: first-time save always errors; toggling preferences
   appears to do nothing.

2. **Conversation participants cannot see each other's names.** The
   `profiles` SELECT policy only lets a user read their own row
   (`auth.uid() = id`) or, for admins, all rows. When a user opens
   a conversation, the embedded `profile` join on
   `conversation_participants.user_id` returns null for the *other*
   participant because RLS blocks their profile row. The chat header
   and list show "Unknown" instead of the other person's name.

## Fixes
1. Add `DEFAULT auth.uid()` to
   `notification_preferences.user_id` so the insert succeeds even
   when the client omits the column (per the standard owner-column
   pattern). Existing rows keep their `user_id`; the default only
   applies to new inserts.

2. Add a SELECT policy `profiles_select_conversation_peer` that lets
   an authenticated user read the profile of any user who shares a
   conversation with them (membership checked via
   `conversation_participants`). This is the minimum access needed
   to render conversation peer names; it does NOT expose profiles to
   the public or to non-peers.

## Security
- No destructive changes.
- The new profiles policy is scoped: a user can only read profiles of
  users who are in a conversation they also participate in. It does
  not grant broad profile access.
- Preferences INSERT/UPDATE/SELECT policies unchanged; the default
  just makes the existing `np_insert_own` check satisfiable.
*/

-- 1. Fix preferences: default user_id to the authenticated user so
--    inserts that omit user_id (the normal case) satisfy the
--    np_insert_own WITH CHECK (auth.uid() = user_id) policy.
ALTER TABLE notification_preferences
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 2. Let conversation participants read each other's profile (name)
--    so the messaging UI can render peer names instead of "Unknown".
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
