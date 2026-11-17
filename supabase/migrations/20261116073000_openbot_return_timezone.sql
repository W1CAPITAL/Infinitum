-- Use Sao Paulo business day for every accepted legal return.
CREATE OR REPLACE FUNCTION public.register_office_agent_return(p_reply_event_id uuid,p_next_return date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_uid uuid:=auth.uid();v_empresa uuid;v_name text;v_event public.office_agent_reply_events%ROWTYPE;
 v_existing date;v_registered boolean:=false;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória'; END IF;
 SELECT u.empresa_id,u.nome INTO v_empresa,v_name FROM public.usuarios u WHERE u.auth_user_id=v_uid LIMIT 1;
 IF v_empresa IS NULL THEN RAISE EXCEPTION 'Empresa não identificada'; END IF;
 IF p_next_return < (now() AT TIME ZONE 'America/Sao_Paulo')::date+7 OR p_next_return > (now() AT TIME ZONE 'America/Sao_Paulo')::date+60 THEN
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
 UPDATE public.processos SET ultimo_retorno=(now() AT TIME ZONE 'America/Sao_Paulo')::date,proximo_retorno=p_next_return,
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
