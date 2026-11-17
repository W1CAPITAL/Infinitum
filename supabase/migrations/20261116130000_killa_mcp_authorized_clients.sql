-- OAuth MCP client allowlist: protects even if a user pastes a public API key.
-- Existing killa_mcp_settings.owner_id and admin-only RLS remain unchanged.
alter table public.killa_mcp_settings
  add column if not exists allowed_client_ids text[] not null default '{}'::text[],
  add column if not exists require_mfa boolean not null default true;
alter table public.killa_mcp_settings
  drop constraint if exists killa_mcp_mfa_required;
alter table public.killa_mcp_settings
  add constraint killa_mcp_mfa_required check (require_mfa=true);
alter table public.killa_mcp_settings
  drop constraint if exists killa_mcp_allowed_clients_limited;
alter table public.killa_mcp_settings
  add constraint killa_mcp_allowed_clients_limited
   check (cardinality(allowed_client_ids)<=20 and array_position(allowed_client_ids,null) is null);
comment on column public.killa_mcp_settings.allowed_client_ids is
 'Admin-approved OAuth client IDs only. No secrets or access tokens belong here.';
