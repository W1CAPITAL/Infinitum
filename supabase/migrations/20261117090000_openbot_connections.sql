-- Encrypted multi-account OAuth connections, isolated by the owner.
CREATE TABLE IF NOT EXISTS public.openbot_connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN ('google','meta')),
 external_account_id text NOT NULL CHECK(length(external_account_id) BETWEEN 1 AND 200),
 display_name text NOT NULL DEFAULT '' CHECK(length(display_name)<=240),
 email text NOT NULL DEFAULT '' CHECK(length(email)<=240),
 scopes text[] NOT NULL DEFAULT '{}',
 tokens_ciphertext text NOT NULL CHECK(length(tokens_ciphertext) BETWEEN 30 AND 30000),
 status text NOT NULL DEFAULT 'connected' CHECK(status IN ('connected','needs_reconnect','revoked')),
 expires_at timestamptz,
 last_checked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,provider,external_account_id)
);
CREATE INDEX IF NOT EXISTS openbot_connections_owner_idx ON public.openbot_connections(owner_id,provider);
CREATE TABLE IF NOT EXISTS public.openbot_oauth_states (
 nonce text PRIMARY KEY CHECK(length(nonce) BETWEEN 24 AND 100),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 provider text NOT NULL CHECK(provider IN ('google','meta')),
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS openbot_oauth_states_owner_idx ON public.openbot_oauth_states(owner_id,expires_at);
ALTER TABLE public.openbot_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openbot_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.openbot_connections,public.openbot_oauth_states FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.openbot_connections,public.openbot_oauth_states TO authenticated;
DROP POLICY IF EXISTS openbot_connections_own_select ON public.openbot_connections;
DROP POLICY IF EXISTS openbot_connections_own_insert ON public.openbot_connections;
DROP POLICY IF EXISTS openbot_connections_own_update ON public.openbot_connections;
DROP POLICY IF EXISTS openbot_connections_own_delete ON public.openbot_connections;
DROP POLICY IF EXISTS openbot_oauth_states_own_select ON public.openbot_oauth_states;
DROP POLICY IF EXISTS openbot_oauth_states_own_insert ON public.openbot_oauth_states;
DROP POLICY IF EXISTS openbot_oauth_states_own_update ON public.openbot_oauth_states;
DROP POLICY IF EXISTS openbot_oauth_states_own_delete ON public.openbot_oauth_states;
CREATE POLICY openbot_connections_own_select ON public.openbot_connections FOR SELECT TO authenticated USING(owner_id=(select auth.uid()));
CREATE POLICY openbot_connections_own_insert ON public.openbot_connections FOR INSERT TO authenticated WITH CHECK(owner_id=(select auth.uid()));
CREATE POLICY openbot_connections_own_update ON public.openbot_connections FOR UPDATE TO authenticated USING(owner_id=(select auth.uid())) WITH CHECK(owner_id=(select auth.uid()));
CREATE POLICY openbot_connections_own_delete ON public.openbot_connections FOR DELETE TO authenticated USING(owner_id=(select auth.uid()));
CREATE POLICY openbot_oauth_states_own_select ON public.openbot_oauth_states FOR SELECT TO authenticated USING(owner_id=(select auth.uid()));
CREATE POLICY openbot_oauth_states_own_insert ON public.openbot_oauth_states FOR INSERT TO authenticated WITH CHECK(owner_id=(select auth.uid()));
CREATE POLICY openbot_oauth_states_own_update ON public.openbot_oauth_states FOR UPDATE TO authenticated USING(owner_id=(select auth.uid())) WITH CHECK(owner_id=(select auth.uid()));
CREATE POLICY openbot_oauth_states_own_delete ON public.openbot_oauth_states FOR DELETE TO authenticated USING(owner_id=(select auth.uid()));
