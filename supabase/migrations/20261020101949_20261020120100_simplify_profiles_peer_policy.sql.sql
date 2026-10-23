/*
# Simplify profiles_select_conversation_peer to use helper function

## Change
Replace the double-nested subquery in `profiles_select_conversation_peer`
with a call to `private.is_conversation_participant`, matching the pattern
used in the other conversation-related policies.

## Security
Same access control as before — a user can read another user's profile only
if they share a conversation. The helper function is SECURITY DEFINER and
bypasses RLS on conversation_participants, preventing recursion.
*/

DROP POLICY IF EXISTS "profiles_select_conversation_peer" ON public.profiles;
CREATE POLICY "profiles_select_conversation_peer"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.user_id = profiles.id
        AND private.is_conversation_participant(auth.uid(), cp.conversation_id)
    )
  );
