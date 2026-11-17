-- MFA must be enforced by RLS, not only by the browser's checkbox.
DROP POLICY IF EXISTS openbot_mcp_grants_prevent_oauth_insert ON public.openbot_mcp_grants;
DROP POLICY IF EXISTS openbot_mcp_grants_prevent_oauth_update ON public.openbot_mcp_grants;
CREATE POLICY openbot_mcp_grants_prevent_oauth_insert ON public.openbot_mcp_grants AS RESTRICTIVE
 FOR INSERT TO authenticated WITH CHECK(
  coalesce((select auth.jwt())->>'client_id','')='' AND
  coalesce((select auth.jwt())->>'aal','')='aal2'
 );
CREATE POLICY openbot_mcp_grants_prevent_oauth_update ON public.openbot_mcp_grants AS RESTRICTIVE
 FOR UPDATE TO authenticated USING(
  coalesce((select auth.jwt())->>'client_id','')='' AND
  coalesce((select auth.jwt())->>'aal','')='aal2'
 ) WITH CHECK(
  coalesce((select auth.jwt())->>'client_id','')='' AND
  coalesce((select auth.jwt())->>'aal','')='aal2'
 );
