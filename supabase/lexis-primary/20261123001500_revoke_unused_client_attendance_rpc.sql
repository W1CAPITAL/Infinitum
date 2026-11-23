-- This legacy client-attendance command has no application or database
-- consumer. Keep it for trusted backend maintenance, but remove the unused
-- authenticated Data API RPC surface.
do $$
declare
  v_dependency text;
begin
  if to_regprocedure(
    'public.infinitum_registrar_atendimento_cliente(uuid,text,date,boolean)'
  ) is null then
    raise exception 'public.infinitum_registrar_atendimento_cliente(uuid,text,date,boolean) not found';
  end if;

  select string_agg(ref, ', ' order by ref)
  into v_dependency
  from (
    select format('policy %I.%I.%I', schemaname, tablename, policyname) as ref
    from pg_catalog.pg_policies
    where concat_ws(' ', qual, with_check) ~ 'infinitum_registrar_atendimento_cliente'

    union all

    select format('default %I.%I.%I', table_schema, table_name, column_name)
    from information_schema.columns
    where table_schema = 'public'
      and coalesce(column_default, '') ~ 'infinitum_registrar_atendimento_cliente'

    union all

    select format('view %I.%I', schemaname, viewname)
    from pg_catalog.pg_views
    where coalesce(definition, '') ~ 'infinitum_registrar_atendimento_cliente'

    union all

    select format('function %s', p.oid::pg_catalog.regprocedure)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where p.prokind = 'f'
      and n.nspname not in ('pg_catalog', 'information_schema')
      and p.oid <> 'public.infinitum_registrar_atendimento_cliente(uuid,text,date,boolean)'::pg_catalog.regprocedure
      and pg_catalog.pg_get_functiondef(p.oid) ~ 'infinitum_registrar_atendimento_cliente'

    union all

    select format('catalog dependency %s/%s', d.classid::pg_catalog.regclass, d.objid)
    from pg_catalog.pg_depend d
    where d.refobjid = 'public.infinitum_registrar_atendimento_cliente(uuid,text,date,boolean)'::pg_catalog.regprocedure
      and d.deptype <> 'i'
  ) dependencies;

  if v_dependency is not null then
    raise exception 'Client attendance RPC still has dependencies: %', v_dependency;
  end if;
end
$$;

revoke execute on function public.infinitum_registrar_atendimento_cliente(uuid,text,date,boolean)
  from public, anon, authenticated;

grant execute on function public.infinitum_registrar_atendimento_cliente(uuid,text,date,boolean)
  to service_role;
