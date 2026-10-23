/*
# Fix RLS Recursion on conversation_participants and profiles

## Problem
The SELECT policy `cp_select_participant` on `conversation_participants`
queries `conversation_participants` itself to verify the current user is a
participant. This causes infinite RLS recursion, crashing every query against
`conversation_participants` and `profiles` (whose
`profiles_select_conversation_peer` policy also reads
`conversation_participants`) with a 500 error.

## Fix
1. Create a `SECURITY DEFINER` function `private.is_conversation_participant(p_user uuid, p_conversation uuid)`
   that checks participation by reading `conversation_participants` as the
   `postgres` owner (bypassing RLS — the table owner is not subject to RLS
   unless `FORCE ROW LEVEL SECURITY` is on, which it is not).
2. Rewrite `cp_select_participant` to use this function instead of a
   self-referential subquery.
3. Rewrite `profiles_select_conversation_peer` to use this function instead of
   querying `conversation_participants` directly.
4. Rewrite `conversations_select_participant` to use this function as well,
   since it reads `conversation_participants` and would otherwise recurse
   through the old `cp_select_participant` policy.

## Security
- The new function is `SECURITY DEFINER`, owned by `postgres`, with
  `search_path = public, private`. It only performs a read-only EXISTS check.
- Execute is granted to `authenticated`.
- No data is exposed beyond what the existing policies already intended.
*/

-- 1. Create the helper function
CREATE OR REPLACE FUNCTION private.is_conversation_participant(p_user uuid, p_conversation uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.user_id = p_user
      AND cp.conversation_id = p_conversation
  );
$$;

GRANT EXECUTE ON FUNCTION private.is_conversation_participant(uuid, uuid) TO authenticated;

-- 2. Fix cp_select_participant — was self-referential
DROP POLICY IF EXISTS "cp_select_participant" ON public.conversation_participants;
CREATE POLICY "cp_select_participant"
  ON public.conversation_participants FOR SELECT
  TO authenticated
  USING (private.is_conversation_participant(auth.uid(), conversation_participants.conversation_id));

-- 3. Fix profiles_select_conversation_peer — was reading conversation_participants
--    which triggered the recursive cp_select_participant policy
DROP POLICY IF EXISTS "profiles_select_conversation_peer" ON public.profiles;
CREATE POLICY "profiles_select_conversation_peer"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.user_id = profiles.id
        AND EXISTS (
          SELECT 1
          FROM public.conversation_participants me
          WHERE me.user_id = auth.uid()
            AND me.conversation_id = cp.conversation_id
        )
    )
  );

-- 4. Fix conversations_select_participant — was reading conversation_participants
--    which triggered the recursive cp_select_participant policy
DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (private.is_conversation_participant(auth.uid(), conversations.id));
