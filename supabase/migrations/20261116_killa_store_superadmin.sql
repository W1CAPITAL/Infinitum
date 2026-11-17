-- Production originally applied through Supabase migration killa_store_superadmin_isolation.
-- Store-only authority; no generic CRM admin receives access automatically.
CREATE SCHEMA IF NOT EXISTS killa_private;
REVOKE ALL ON SCHEMA killa_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS killa_private.killa_store_superadmins (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 enabled boolean NOT NULL DEFAULT true,
 store_mcp_enabled boolean NOT NULL DEFAULT false,
 diagnostics_enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS killa_private.killa_store_release_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 oauth_client_id text,
 version text NOT NULL CHECK (version ~ '^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$'),
 rationale text NOT NULL CHECK (char_length(rationale) BETWEEN 3 AND 500),
 status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending','dispatching','dispatched','uncertain','cancelled','expired')),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '1 hour'),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 reviewed_by uuid REFERENCES auth.users(id),
 github_dispatch_response text CHECK (char_length(github_dispatch_response)<=60)
);
CREATE UNIQUE INDEX IF NOT EXISTS killa_store_active_version
 ON killa_private.killa_store_release_requests(version)
 WHERE status IN ('pending','dispatching','dispatched','uncertain');
CREATE INDEX IF NOT EXISTS killa_store_requests_actor_created
 ON killa_private.killa_store_release_requests(actor_id,created_at DESC);
CREATE TABLE IF NOT EXISTS killa_private.killa_store_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid,
 action text NOT NULL CHECK (char_length(action)<=72),
 request_id uuid,
 summary jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS killa_store_audit_recent
 ON killa_private.killa_store_audit(created_at DESC);
ALTER TABLE killa_private.killa_store_superadmins ENABLE ROW LEVEL SECURITY;
ALTER TABLE killa_private.killa_store_release_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE killa_private.killa_store_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA killa_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA killa_private TO service_role;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA killa_private TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA killa_private TO service_role;
-- Bootstrap only if exactly one enabled administrator exists.
INSERT INTO killa_private.killa_store_superadmins(user_id,enabled)
SELECT user_id,true FROM public.crm_memberships
WHERE role='admin' AND enabled IS TRUE
AND (SELECT count(*) FROM public.crm_memberships
 WHERE role='admin' AND enabled IS TRUE)=1
ON CONFLICT(user_id) DO NOTHING;
-- Release publication remains blocked until superadmin MFA, GitHub token and
-- protected GitHub environment reviewers have been independently configured.
