-- Fix RLS Recursion on conversation_participants and profiles

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

-- 3. Fix profiles_select_conversation_peer — replace with helper-based version
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

-- 4. Fix conversations_select_participant — use helper to avoid recursion
DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (private.is_conversation_participant(auth.uid(), conversations.id));