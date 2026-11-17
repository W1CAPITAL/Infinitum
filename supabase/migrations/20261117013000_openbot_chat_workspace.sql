-- Separate per-user OpenBot agent conversations, accessible only through the authenticated CRM.
-- No WhatsApp messages are imported; no remote computers or tools run from this migration.
CREATE TABLE IF NOT EXISTS public.openbot_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 bot_key text NOT NULL CHECK (char_length(bot_key) BETWEEN 2 AND 32),
 title text NOT NULL DEFAULT 'Nova conversa' CHECK (char_length(title) BETWEEN 1 AND 160),
 model text NOT NULL DEFAULT 'rules' CHECK (char_length(model) BETWEEN 2 AND 40),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS openbot_threads_owner_updated_idx ON public.openbot_threads(owner_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS public.openbot_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 thread_id uuid NOT NULL REFERENCES public.openbot_threads(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('user','assistant')),
 content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 20000),
 source text NOT NULL DEFAULT '' CHECK (char_length(source) <= 140),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS openbot_messages_thread_time_idx ON public.openbot_messages(thread_id,created_at ASC);

CREATE TABLE IF NOT EXISTS public.openbot_profiles (
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 bot_key text NOT NULL CHECK (char_length(bot_key) BETWEEN 2 AND 32),
 instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 1400),
 model text NOT NULL DEFAULT 'rules' CHECK (char_length(model) BETWEEN 2 AND 40),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,bot_key)
);

ALTER TABLE public.openbot_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openbot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openbot_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.openbot_threads,public.openbot_messages,public.openbot_profiles FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.openbot_threads TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.openbot_messages TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.openbot_profiles TO authenticated;

-- Idempotent when the database schema was prepared before this version is deployed.
DROP POLICY IF EXISTS openbot_threads_own_read ON public.openbot_threads;
DROP POLICY IF EXISTS openbot_threads_own_insert ON public.openbot_threads;
DROP POLICY IF EXISTS openbot_threads_own_update ON public.openbot_threads;
DROP POLICY IF EXISTS openbot_threads_own_delete ON public.openbot_threads;
DROP POLICY IF EXISTS openbot_messages_own_read ON public.openbot_messages;
DROP POLICY IF EXISTS openbot_messages_own_insert ON public.openbot_messages;
DROP POLICY IF EXISTS openbot_messages_own_delete ON public.openbot_messages;
DROP POLICY IF EXISTS openbot_profiles_own_read ON public.openbot_profiles;
DROP POLICY IF EXISTS openbot_profiles_own_insert ON public.openbot_profiles;
DROP POLICY IF EXISTS openbot_profiles_own_update ON public.openbot_profiles;
DROP POLICY IF EXISTS openbot_profiles_own_delete ON public.openbot_profiles;
DROP POLICY IF EXISTS openbot_threads_no_oauth_insert ON public.openbot_threads;
DROP POLICY IF EXISTS openbot_threads_no_oauth_update ON public.openbot_threads;
DROP POLICY IF EXISTS openbot_threads_no_oauth_delete ON public.openbot_threads;
DROP POLICY IF EXISTS openbot_messages_no_oauth_insert ON public.openbot_messages;
DROP POLICY IF EXISTS openbot_messages_no_oauth_delete ON public.openbot_messages;
DROP POLICY IF EXISTS openbot_profiles_no_oauth_insert ON public.openbot_profiles;
DROP POLICY IF EXISTS openbot_profiles_no_oauth_update ON public.openbot_profiles;
DROP POLICY IF EXISTS openbot_profiles_no_oauth_delete ON public.openbot_profiles;

-- A user cannot access another user's private agent conversations or switch thread ownership.
CREATE POLICY openbot_threads_own_read ON public.openbot_threads FOR SELECT TO authenticated
 USING(owner_id=(select auth.uid()));
CREATE POLICY openbot_threads_own_insert ON public.openbot_threads FOR INSERT TO authenticated
 WITH CHECK(owner_id=(select auth.uid()));
CREATE POLICY openbot_threads_own_update ON public.openbot_threads FOR UPDATE TO authenticated
 USING(owner_id=(select auth.uid())) WITH CHECK(owner_id=(select auth.uid()));
CREATE POLICY openbot_threads_own_delete ON public.openbot_threads FOR DELETE TO authenticated
 USING(owner_id=(select auth.uid()));

CREATE POLICY openbot_messages_own_read ON public.openbot_messages FOR SELECT TO authenticated
 USING(owner_id=(select auth.uid()) AND EXISTS
   (SELECT 1 FROM public.openbot_threads t WHERE t.id=thread_id AND t.owner_id=(select auth.uid())));
CREATE POLICY openbot_messages_own_insert ON public.openbot_messages FOR INSERT TO authenticated
 WITH CHECK(owner_id=(select auth.uid()) AND EXISTS
   (SELECT 1 FROM public.openbot_threads t WHERE t.id=thread_id AND t.owner_id=(select auth.uid())));
CREATE POLICY openbot_messages_own_delete ON public.openbot_messages FOR DELETE TO authenticated
 USING(owner_id=(select auth.uid()) AND EXISTS
   (SELECT 1 FROM public.openbot_threads t WHERE t.id=thread_id AND t.owner_id=(select auth.uid())));

CREATE POLICY openbot_profiles_own_read ON public.openbot_profiles FOR SELECT TO authenticated
 USING(owner_id=(select auth.uid()));
CREATE POLICY openbot_profiles_own_insert ON public.openbot_profiles FOR INSERT TO authenticated
 WITH CHECK(owner_id=(select auth.uid()));
CREATE POLICY openbot_profiles_own_update ON public.openbot_profiles FOR UPDATE TO authenticated
 USING(owner_id=(select auth.uid())) WITH CHECK(owner_id=(select auth.uid()));
CREATE POLICY openbot_profiles_own_delete ON public.openbot_profiles FOR DELETE TO authenticated
 USING(owner_id=(select auth.uid()));

-- OAuth apps must not modify CRM data directly. They can only use the authorized MCP surface.
CREATE POLICY openbot_threads_no_oauth_insert ON public.openbot_threads AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(coalesce((select auth.jwt())->>'client_id','')='');
CREATE POLICY openbot_threads_no_oauth_update ON public.openbot_threads AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(coalesce((select auth.jwt())->>'client_id','')='')
 WITH CHECK(coalesce((select auth.jwt())->>'client_id','')='');
CREATE POLICY openbot_threads_no_oauth_delete ON public.openbot_threads AS RESTRICTIVE FOR DELETE TO authenticated
 USING(coalesce((select auth.jwt())->>'client_id','')='');
CREATE POLICY openbot_messages_no_oauth_insert ON public.openbot_messages AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(coalesce((select auth.jwt())->>'client_id','')='');
CREATE POLICY openbot_messages_no_oauth_delete ON public.openbot_messages AS RESTRICTIVE FOR DELETE TO authenticated
 USING(coalesce((select auth.jwt())->>'client_id','')='');
CREATE POLICY openbot_profiles_no_oauth_insert ON public.openbot_profiles AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(coalesce((select auth.jwt())->>'client_id','')='');
CREATE POLICY openbot_profiles_no_oauth_update ON public.openbot_profiles AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(coalesce((select auth.jwt())->>'client_id','')='')
 WITH CHECK(coalesce((select auth.jwt())->>'client_id','')='');
CREATE POLICY openbot_profiles_no_oauth_delete ON public.openbot_profiles AS RESTRICTIVE FOR DELETE TO authenticated
 USING(coalesce((select auth.jwt())->>'client_id','')='');
