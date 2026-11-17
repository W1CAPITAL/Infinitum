-- One-time callback binding for Composio Connect Links.
-- The callback must match the account ID returned when the authenticated user
-- initiated the link; the account is then verified again through that user's session.
CREATE TABLE IF NOT EXISTS public.openbot_composio_states (
 nonce text PRIMARY KEY CHECK(length(nonce) BETWEEN 32 AND 100),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 toolkit text NOT NULL CHECK(toolkit IN ('instagram','whatsapp')),
 expected_account_id text NOT NULL CHECK(length(expected_account_id) BETWEEN 6 AND 200),
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS openbot_composio_states_owner_idx
 ON public.openbot_composio_states(owner_id,expires_at);
ALTER TABLE public.openbot_composio_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.openbot_composio_states FROM PUBLIC,anon,authenticated;

-- Persist one Composio session per INFINITUM user so approvals and tool state
-- remain tied to the same remote session across Vercel requests.
CREATE TABLE IF NOT EXISTS public.openbot_composio_sessions (
 owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id text NOT NULL UNIQUE CHECK(length(session_id) BETWEEN 6 AND 200),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.openbot_composio_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.openbot_composio_sessions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.openbot_composio_states,public.openbot_composio_sessions TO service_role;
