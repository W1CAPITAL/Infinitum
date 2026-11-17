-- Server-only live-session validation before showing environment status or performing release operations.
CREATE OR REPLACE FUNCTION public.killa_store_validate_session(p_user_id uuid,p_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(
  SELECT 1 FROM auth.sessions s
  JOIN killa_private.killa_store_superadmins a ON a.user_id=s.user_id AND a.enabled IS TRUE
  JOIN public.crm_memberships m ON m.user_id=s.user_id AND m.enabled IS TRUE AND m.role='admin'
  WHERE s.user_id=p_user_id AND s.id=p_session_id
    AND (s.not_after IS NULL OR s.not_after>now())
 ) $$;
REVOKE ALL ON FUNCTION public.killa_store_validate_session(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.killa_store_validate_session(uuid,uuid) TO service_role;
