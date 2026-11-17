-- Company-owned OpenBot settings, staff handoff and one-time accepted WhatsApp return.
CREATE TABLE IF NOT EXISTS public.office_agent_company_policies (
 empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
 config jsonb NOT NULL DEFAULT '{}'::jsonb, updated_by uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT office_agent_company_policies_config_object CHECK (jsonb_typeof(config)='object' AND pg_column_size(config)<=22000)
);
ALTER TABLE public.office_agent_company_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS office_agent_company_read ON public.office_agent_company_policies;
CREATE POLICY office_agent_company_read ON public.office_agent_company_policies FOR SELECT TO authenticated USING (empresa_id=(select public.get_user_empresa_id()));
DROP POLICY IF EXISTS office_agent_company_write ON public.office_agent_company_policies;
CREATE POLICY office_agent_company_write ON public.office_agent_company_policies FOR ALL TO authenticated
 USING (empresa_id=(select public.get_user_empresa_id()) AND EXISTS(
  SELECT 1 FROM public.usuarios u WHERE u.auth_user_id=(select auth.uid()) AND u.empresa_id=office_agent_company_policies.empresa_id AND lower(coalesce(u.role,''))='administrador'))
 WITH CHECK (empresa_id=(select public.get_user_empresa_id()) AND updated_by=(select auth.uid()) AND EXISTS(
  SELECT 1 FROM public.usuarios u WHERE u.auth_user_id=(select auth.uid()) AND u.empresa_id=office_agent_company_policies.empresa_id AND lower(coalesce(u.role,''))='administrador'));
REVOKE ALL ON public.office_agent_company_policies FROM anon;
GRANT SELECT,INSERT,UPDATE ON public.office_agent_company_policies TO authenticated;

CREATE TABLE IF NOT EXISTS public.office_agent_style_votes (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL,
 tag text NOT NULL CHECK (tag IN ('more_cordial','more_concise','more_natural','avoid_repetition','mention_sources')),
 approved_count int NOT NULL DEFAULT 0 CHECK (approved_count BETWEEN 0 AND 20),
 rejected_count int NOT NULL DEFAULT 0 CHECK (rejected_count BETWEEN 0 AND 20),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (empresa_id,owner_id,tag)
);
ALTER TABLE public.office_agent_style_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS office_agent_style_company_read ON public.office_agent_style_votes;
CREATE POLICY office_agent_style_company_read ON public.office_agent_style_votes FOR SELECT TO authenticated USING (empresa_id=(select public.get_user_empresa_id()));
DROP POLICY IF EXISTS office_agent_style_owner_insert ON public.office_agent_style_votes;
CREATE POLICY office_agent_style_owner_insert ON public.office_agent_style_votes FOR INSERT TO authenticated
 WITH CHECK (empresa_id=(select public.get_user_empresa_id()) AND owner_id=(select auth.uid()));
DROP POLICY IF EXISTS office_agent_style_owner_update ON public.office_agent_style_votes;
CREATE POLICY office_agent_style_owner_update ON public.office_agent_style_votes FOR UPDATE TO authenticated
 USING (empresa_id=(select public.get_user_empresa_id()) AND owner_id=(select auth.uid()))
 WITH CHECK (empresa_id=(select public.get_user_empresa_id()) AND owner_id=(select auth.uid()));
REVOKE ALL ON public.office_agent_style_votes FROM anon;
GRANT SELECT,INSERT,UPDATE ON public.office_agent_style_votes TO authenticated;

CREATE TABLE IF NOT EXISTS public.office_agent_contact_rules (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
 jid text NOT NULL CHECK (jid ~ '^[0-9]{10,15}@(s[.]whatsapp[.]net|g[.]us)$' OR jid ~ '^[0-9-]{6,30}@g[.]us$'),
 mode text NOT NULL CHECK (mode IN ('staff_active','silence','administrative','review')),
 assigned_staff text NOT NULL DEFAULT '',
 suppress_until timestamptz NOT NULL DEFAULT (now()+interval '7 days'),
 updated_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (empresa_id,jid)
);
ALTER TABLE public.office_agent_contact_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS office_agent_contact_read ON public.office_agent_contact_rules;
CREATE POLICY office_agent_contact_read ON public.office_agent_contact_rules FOR SELECT TO authenticated
 USING (empresa_id=(select public.get_user_empresa_id()));
DROP POLICY IF EXISTS office_agent_contact_insert ON public.office_agent_contact_rules;
CREATE POLICY office_agent_contact_insert ON public.office_agent_contact_rules FOR INSERT TO authenticated
 WITH CHECK (empresa_id=(select public.get_user_empresa_id()) AND updated_by=(select auth.uid()));
DROP POLICY IF EXISTS office_agent_contact_update ON public.office_agent_contact_rules;
CREATE POLICY office_agent_contact_update ON public.office_agent_contact_rules FOR UPDATE TO authenticated
 USING (empresa_id=(select public.get_user_empresa_id()) AND
 (updated_by=(select auth.uid()) OR EXISTS(SELECT 1 FROM public.usuarios u WHERE u.auth_user_id=(select auth.uid())
 AND u.empresa_id=office_agent_contact_rules.empresa_id AND lower(coalesce(u.role,''))='administrador')))
 WITH CHECK (empresa_id=(select public.get_user_empresa_id()) AND updated_by=(select auth.uid()));
REVOKE ALL ON public.office_agent_contact_rules FROM anon;
GRANT SELECT,INSERT,UPDATE ON public.office_agent_contact_rules TO authenticated;

CREATE TABLE IF NOT EXISTS public.office_agent_return_records (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
 reply_event_id uuid NOT NULL REFERENCES public.office_agent_reply_events(id),
 processo_id bigint NOT NULL REFERENCES public.processos(id),
 owner_id uuid NOT NULL, next_return date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (empresa_id,reply_event_id)
);
CREATE INDEX IF NOT EXISTS office_agent_return_records_case_idx ON public.office_agent_return_records(empresa_id,processo_id,created_at DESC);
ALTER TABLE public.office_agent_return_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS office_agent_return_read ON public.office_agent_return_records;
CREATE POLICY office_agent_return_read ON public.office_agent_return_records FOR SELECT TO authenticated
 USING (empresa_id=(select public.get_user_empresa_id()));
REVOKE ALL ON public.office_agent_return_records FROM anon,authenticated;
GRANT SELECT ON public.office_agent_return_records TO authenticated;

CREATE OR REPLACE FUNCTION public.register_office_agent_return(p_reply_event_id uuid,p_next_return date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_uid uuid:=auth.uid();v_empresa uuid;v_name text;v_event public.office_agent_reply_events%ROWTYPE;
 v_existing date;v_registered boolean:=false;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória'; END IF;
 SELECT u.empresa_id,u.nome INTO v_empresa,v_name FROM public.usuarios u WHERE u.auth_user_id=v_uid LIMIT 1;
 IF v_empresa IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
 IF p_next_return < current_date+7 OR p_next_return > current_date+60 THEN
  RAISE EXCEPTION 'O próximo retorno deve estar entre 7 e 60 dias'; END IF;
 SELECT e.* INTO v_event FROM public.office_agent_reply_events e
 WHERE e.id=p_reply_event_id AND e.owner_id=v_uid AND e.empresa_id=v_empresa
 AND e.status='accepted' AND nullif(e.provider_message_id,'') IS NOT NULL
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'O retorno exige envio aceito pelo WhatsApp do operador e pela empresa'; END IF;
 SELECT r.next_return INTO v_existing FROM public.office_agent_return_records r
 WHERE r.empresa_id=v_empresa AND r.reply_event_id=p_reply_event_id;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'already_recorded',true,'next_return',v_existing); END IF;
 INSERT INTO public.office_agent_return_records(empresa_id,reply_event_id,processo_id,owner_id,next_return)
 VALUES (v_empresa,p_reply_event_id,v_event.processo_id,v_uid,p_next_return)
 ON CONFLICT (empresa_id,reply_event_id) DO NOTHING;
 IF NOT FOUND THEN
  SELECT r.next_return INTO v_existing FROM public.office_agent_return_records r
  WHERE r.empresa_id=v_empresa AND r.reply_event_id=p_reply_event_id;
  RETURN jsonb_build_object('ok',true,'already_recorded',true,'next_return',v_existing);
 END IF;
 UPDATE public.processos SET ultimo_retorno=current_date,proximo_retorno=p_next_return,
  atendido_por=left('OpenBot / '||coalesce(v_name,'Operador'),160)
 WHERE id=v_event.processo_id AND empresa_id=v_empresa;
 IF NOT FOUND THEN RAISE EXCEPTION 'Processo da empresa não encontrado'; END IF;
 INSERT INTO public.crm_atividades(id,empresa_id,tipo,titulo,corpo,created_by,created_by_nome,meta)
 VALUES ('openbot-retorno-'||p_reply_event_id::text,v_empresa,'atendimento',
  'Retorno confirmado no WhatsApp · OpenBot',
  'WhatsApp aceitou o envio; entrega e leitura não comprovadas. Próximo retorno: '||p_next_return::text,
  v_uid::text,left('OpenBot / '||coalesce(v_name,'Operador'),160),
  jsonb_build_object('processo_id',v_event.processo_id,'reply_event_id',p_reply_event_id,
   'next_return',p_next_return,'agent','OpenBot','transport_status','accepted'))
 ON CONFLICT (id) DO NOTHING;
 RETURN jsonb_build_object('ok',true,'already_recorded',false,'next_return',p_next_return);
END $$;
REVOKE ALL ON FUNCTION public.register_office_agent_return(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_office_agent_return(uuid,date) TO authenticated;
