-- A trigger-only function must not be exposed as a PostgREST RPC.
-- The trigger keeps executing with its existing SECURITY DEFINER context.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'office_agent_memory_cap'
      and pg_catalog.pg_get_function_identity_arguments(p.oid) = ''
      and p.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype
  ) then
    raise exception 'public.office_agent_memory_cap() trigger function not found';
  end if;
end
$$;

revoke execute on function public.office_agent_memory_cap()
  from public, anon, authenticated;

grant execute on function public.office_agent_memory_cap()
  to service_role;
