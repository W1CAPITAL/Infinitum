-- Killa AI / MCP boundary: OAuth access tokens must be read-only at PostgreSQL.
-- An OAuth token has a signed auth.jwt()->>'client_id'; ordinary first-party
-- employee sessions do not. This guard survives tampered JS and REST calls.
-- Service-role/DB administrators bypass RLS by design: protect those secrets.
DO $killa$
DECLARE tab record;
BEGIN
 FOR tab IN SELECT n.nspname AS schema_name,c.relname AS table_name
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity
 LOOP
  EXECUTE format('DROP POLICY IF EXISTS killa_oauth_no_insert ON %I.%I',tab.schema_name,tab.table_name);
  EXECUTE format('CREATE POLICY killa_oauth_no_insert ON %I.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((SELECT auth.jwt()->>''client_id'') IS NULL)',
    tab.schema_name,tab.table_name);
  EXECUTE format('DROP POLICY IF EXISTS killa_oauth_no_update ON %I.%I',tab.schema_name,tab.table_name);
  EXECUTE format('CREATE POLICY killa_oauth_no_update ON %I.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING ((SELECT auth.jwt()->>''client_id'') IS NULL) WITH CHECK ((SELECT auth.jwt()->>''client_id'') IS NULL)',
    tab.schema_name,tab.table_name);
  EXECUTE format('DROP POLICY IF EXISTS killa_oauth_no_delete ON %I.%I',tab.schema_name,tab.table_name);
  EXECUTE format('CREATE POLICY killa_oauth_no_delete ON %I.%I AS RESTRICTIVE FOR DELETE TO authenticated USING ((SELECT auth.jwt()->>''client_id'') IS NULL)',
    tab.schema_name,tab.table_name);
  -- RLS does not protect TRUNCATE, so revoke it for both client roles.
  EXECUTE format('REVOKE TRUNCATE ON %I.%I FROM authenticated, anon',tab.schema_name,tab.table_name);
  -- Legacy CRM tables inherited broad anonymous write grants: remove them.
  -- Explicit public intake policies (if needed) must be separately reviewed.
  EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %I.%I FROM anon',tab.schema_name,tab.table_name);
 END LOOP;
END $killa$;
comment on table public.killa_mcp_settings is
 'MCP admin opt-in. OAuth tools only read this table; three restrictive policies block OAuth writes across protected public tables.';
