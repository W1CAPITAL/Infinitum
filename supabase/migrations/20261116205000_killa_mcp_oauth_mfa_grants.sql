-- Supabase OAuth authorization-code sessions are issued at AAL1.
-- Preserve the real AAL2 check on the interactive consent session as a short-lived,
-- server-side proof bound to the same user, company and OAuth client.
CREATE TABLE IF NOT EXISTS public.killa_mcp_oauth_mfa_grants (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
 client_id uuid NOT NULL REFERENCES auth.oauth_clients(id) ON DELETE CASCADE,
 authorization_id text NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,client_id),
 CONSTRAINT killa_mcp_oauth_mfa_grant_expiry CHECK (expires_at>verified_at)
);
CREATE INDEX IF NOT EXISTS killa_mcp_oauth_mfa_grants_expiry_idx
 ON public.killa_mcp_oauth_mfa_grants(user_id,client_id,expires_at);
ALTER TABLE public.killa_mcp_oauth_mfa_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.killa_mcp_oauth_mfa_grants FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.killa_record_mcp_mfa_grant(p_authorization_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public,auth
AS $$
DECLARE
 v_uid uuid:=auth.uid();
 v_empresa uuid;
 v_client uuid;
 v_config jsonb;
 v_expires timestamptz;
BEGIN
 IF v_uid IS NULL THEN
  RAISE EXCEPTION 'Sessão obrigatória para registrar MFA.' USING ERRCODE='42501';
 END IF;
 IF coalesce(auth.jwt()->>'aal','aal1')<>'aal2' THEN
  RAISE EXCEPTION 'Confirme o segundo fator nesta sessão antes de autorizar o MCP.' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM auth.mfa_factors f
  WHERE f.user_id=v_uid AND f.status='verified'
 ) THEN
  RAISE EXCEPTION 'Nenhum segundo fator verificado está cadastrado.' USING ERRCODE='42501';
 END IF;
 IF p_authorization_id IS NULL OR length(p_authorization_id)<12 OR length(p_authorization_id)>160 THEN
  RAISE EXCEPTION 'Solicitação OAuth inválida.' USING ERRCODE='22023';
 END IF;
 SELECT u.empresa_id INTO v_empresa
 FROM public.usuarios u
 WHERE u.auth_user_id=v_uid
 LIMIT 2;
 IF v_empresa IS NULL THEN
  RAISE EXCEPTION 'Usuário sem empresa vinculada.' USING ERRCODE='42501';
 END IF;
 SELECT a.client_id INTO v_client
 FROM auth.oauth_authorizations a
 WHERE a.authorization_id=p_authorization_id
  AND a.user_id=v_uid
 LIMIT 1;
 IF v_client IS NULL THEN
  RAISE EXCEPTION 'Solicitação OAuth não pertence a esta conta ou expirou.' USING ERRCODE='42501';
 END IF;
 SELECT p.config INTO v_config
 FROM public.office_agent_company_policies p
 WHERE p.empresa_id=v_empresa;
 IF v_config IS NULL OR v_config->>'mcp_enabled' IS DISTINCT FROM 'true' THEN
  RAISE EXCEPTION 'O MCP não está habilitado para esta empresa.' USING ERRCODE='42501';
 END IF;
 IF NOT (coalesce(v_config->'mcp_allowed_client_ids','[]'::jsonb) ? v_client::text) THEN
  RAISE EXCEPTION 'Este cliente OAuth não foi autorizado pelo administrador.' USING ERRCODE='42501';
 END IF;
 v_expires:=now()+interval '8 hours';
 INSERT INTO public.killa_mcp_oauth_mfa_grants(user_id,empresa_id,client_id,authorization_id,verified_at,expires_at)
 VALUES(v_uid,v_empresa,v_client,p_authorization_id,now(),v_expires)
 ON CONFLICT(user_id,client_id) DO UPDATE SET
  empresa_id=excluded.empresa_id,
  authorization_id=excluded.authorization_id,
  verified_at=excluded.verified_at,
  expires_at=excluded.expires_at;
 RETURN jsonb_build_object('ok',true,'expires_at',v_expires);
END;
$$;

CREATE OR REPLACE FUNCTION public.killa_check_mcp_mfa_grant(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,public,auth
AS $$
 SELECT EXISTS (
  SELECT 1
  FROM public.killa_mcp_oauth_mfa_grants g
  JOIN public.usuarios u
   ON u.auth_user_id=g.user_id AND u.empresa_id=g.empresa_id
  JOIN public.office_agent_company_policies p
   ON p.empresa_id=g.empresa_id
  WHERE g.user_id=auth.uid()
   AND g.client_id=p_client_id
   AND g.expires_at>now()
   AND p.config->>'mcp_enabled'='true'
   AND coalesce(p.config->'mcp_allowed_client_ids','[]'::jsonb) ? p_client_id::text
   AND EXISTS (
    SELECT 1 FROM auth.mfa_factors f
    WHERE f.user_id=auth.uid() AND f.status='verified'
   )
 );
$$;

REVOKE ALL ON FUNCTION public.killa_record_mcp_mfa_grant(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.killa_check_mcp_mfa_grant(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.killa_record_mcp_mfa_grant(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.killa_check_mcp_mfa_grant(uuid) TO authenticated;

COMMENT ON TABLE public.killa_mcp_oauth_mfa_grants IS
 'Short-lived proof that this user completed AAL2 in the INFINITUM OAuth consent session for this exact approved client. Supabase OAuth access tokens may themselves be AAL1.';
