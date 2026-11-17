-- Killa AI MCP: owner-scoped opt-in on the native INFINITUM CRM.
-- Separate from optional LexisPredict 'usuarios' / 'office_agent_company_policies'.
create table if not exists public.killa_mcp_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  mcp_enabled boolean not null default false,
  permission_level text not null default 'basico'
    check (permission_level in ('basico','medio','alto','muito_alto','maximo')),
  mcp_group_history_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.killa_mcp_settings enable row level security;
drop policy if exists killa_mcp_owner_read on public.killa_mcp_settings;
create policy killa_mcp_owner_read on public.killa_mcp_settings
 for select to authenticated using (owner_id=(select auth.uid()));
drop policy if exists killa_mcp_owner_admin_insert on public.killa_mcp_settings;
create policy killa_mcp_owner_admin_insert on public.killa_mcp_settings
 for insert to authenticated with check (
  owner_id=(select auth.uid()) and exists (
   select 1 from public.crm_memberships m where m.user_id=(select auth.uid())
   and m.enabled=true and m.role='admin'
  ));
drop policy if exists killa_mcp_owner_admin_update on public.killa_mcp_settings;
create policy killa_mcp_owner_admin_update on public.killa_mcp_settings
 for update to authenticated using (
  owner_id=(select auth.uid()) and exists (
   select 1 from public.crm_memberships m where m.user_id=(select auth.uid())
   and m.enabled=true and m.role='admin'
  ))
 with check (
  owner_id=(select auth.uid()) and exists (
   select 1 from public.crm_memberships m where m.user_id=(select auth.uid())
   and m.enabled=true and m.role='admin'
  ));
revoke all on public.killa_mcp_settings from anon;
grant select,insert,update on public.killa_mcp_settings to authenticated;
