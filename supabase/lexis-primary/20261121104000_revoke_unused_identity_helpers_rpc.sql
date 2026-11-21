-- These legacy identity helpers have no policy, default, view, function or
-- application consumer. Keep them available to trusted backend maintenance,
-- but remove the unnecessary authenticated Data API RPC surface.
do $$
declare
  v_dependency text;
begin
  if to_regprocedure('public.current_usuario()') is null then
    raise exception 'public.current_usuario() not found';
  end if;

  if to_regprocedure('public.meu_empresa_id()') is null then
    raise exception 'public.meu_empresa_id() not found';
  end if;

  select string_agg(ref, ', ' order by ref)
  into v_dependency
  from (
    select format('policy %I.%I.%I', schemaname, tablename, policyname) as ref
    from pg_catalog.pg_policies
    where concat_ws(' ', qual, with_check) ~ '(current_usuario|meu_empresa_id)'

    union all

    select format('default %I.%I.%I', table_schema, table_name, column_name)
    from information_schema.columns
    where table_schema = 'public'
      and coalesce(column_default, '') ~ '(current_usuario|meu_empresa_id)'

    union all

    select format('view %I.%I', schemaname, viewname)
    from pg_catalog.pg_views
    where schemaname = 'public'
      and coalesce(definition, '') ~ '(current_usuario|meu_empresa_id)'

    union all

    select format('function %s', p.oid::pg_catalog.regprocedure)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where p.prokind = 'f'
      and n.nspname not in ('pg_catalog', 'information_schema')
      and p.proname not in ('current_usuario', 'meu_empresa_id')
      and pg_catalog.pg_get_functiondef(p.oid) ~ '(current_usuario|meu_empresa_id)'
  ) dependencies;

  if v_dependency is not null then
    raise exception 'Legacy identity helper still has dependencies: %', v_dependency;
  end if;
end
$$;

revoke execute on function public.current_usuario() from public, anon, authenticated;
revoke execute on function public.meu_empresa_id() from public, anon, authenticated;

grant execute on function public.current_usuario() to service_role;
grant execute on function public.meu_empresa_id() to service_role;
