-- OAuth clients approved by a signed-in operator after MFA. No automatic sending.
CREATE TABLE IF NOT EXISTS public.openbot_mcp_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 client_id text NOT NULL CHECK(length(client_id) BETWEEN 5 AND 200),
 enabled boolean NOT NULL DEFAULT true,
 approved_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 UNIQUE(owner_id,client_id)
);
CREATE INDEX IF NOT EXISTS openbot_mcp_grants_owner_idx ON public.openbot_mcp_grants(owner_id,expires_at);
ALTER TABLE public.openbot_mcp_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.openbot_mcp_grants FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.openbot_mcp_grants TO authenticated;
DROP POLICY IF EXISTS openbot_mcp_grants_read ON public.openbot_mcp_grants;
DROP POLICY IF EXISTS openbot_mcp_grants_insert ON public.openbot_mcp_grants;
DROP POLICY IF EXISTS openbot_mcp_grants_update ON public.openbot_mcp_grants;
DROP POLICY IF EXISTS openbot_mcp_grants_delete ON public.openbot_mcp_grants;
DROP POLICY IF EXISTS openbot_mcp_grants_prevent_oauth_insert ON public.openbot_mcp_grants;
DROP POLICY IF EXISTS openbot_mcp_grants_prevent_oauth_update ON public.openbot_mcp_grants;
DROP POLICY IF EXISTS openbot_mcp_grants_prevent_oauth_delete ON public.openbot_mcp_grants;
CREATE POLICY openbot_mcp_grants_read ON public.openbot_mcp_grants FOR SELECT TO authenticated
 USING(owner_id=(select auth.uid()));
CREATE POLICY openbot_mcp_grants_insert ON public.openbot_mcp_grants FOR INSERT TO authenticated
 WITH CHECK(owner_id=(select auth.uid()));
CREATE POLICY openbot_mcp_grants_update ON public.openbot_mcp_grants FOR UPDATE TO authenticated
 USING(owner_id=(select auth.uid())) WITH CHECK(owner_id=(select auth.uid()));
CREATE POLICY openbot_mcp_grants_delete ON public.openbot_mcp_grants FOR DELETE TO authenticated
 USING(owner_id=(select auth.uid()));
-- OAuth sessions are read-only clients; they cannot approve or revoke themselves.
CREATE POLICY openbot_mcp_grants_prevent_oauth_insert ON public.openbot_mcp_grants AS RESTRICTIVE
 FOR INSERT TO authenticated WITH CHECK(coalesce((select auth.jwt())->>'client_id','')='');
CREATE POLICY openbot_mcp_grants_prevent_oauth_update ON public.openbot_mcp_grants AS RESTRICTIVE
 FOR UPDATE TO authenticated USING(coalesce((select auth.jwt())->>'client_id','')='')
 WITH CHECK(coalesce((select auth.jwt())->>'client_id','')='');
CREATE POLICY openbot_mcp_grants_prevent_oauth_delete ON public.openbot_mcp_grants AS RESTRICTIVE
 FOR DELETE TO authenticated USING(coalesce((select auth.jwt())->>'client_id','')='');
