-- Keep the RLS helper callable by authenticated policies, but avoid granting
-- superadmin access to role labels that merely contain the word.
do $$
begin
  if to_regprocedure('public.is_superadmin()') is null then
    raise exception 'public.is_superadmin() not found';
  end if;

  if exists (
    select 1
    from public.usuarios u
    where (
      coalesce(u.role, '') ilike '%superadmin%'
      or coalesce(u.cargo::text, '') ilike '%superadmin%'
    )
      and lower(btrim(coalesce(u.role, ''))) <> 'superadmin'
      and lower(btrim(coalesce(u.cargo::text, ''))) <> 'superadmin'
  ) then
    raise exception 'Ambiguous historic superadmin role requires manual review';
  end if;
end
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = auth.uid()
      and (
        lower(btrim(coalesce(u.role, ''))) = 'superadmin'
        or lower(btrim(coalesce(u.cargo::text, ''))) = 'superadmin'
      )
  );
$function$;

