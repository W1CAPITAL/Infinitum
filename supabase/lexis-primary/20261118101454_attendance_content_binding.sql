-- Supabase principal W1. Aditivo; não reescreve eventos históricos.
set lock_timeout = '5s';
set statement_timeout = '30s';
alter table public.tarefas_realizadas
 add column if not exists attendance_request_payload jsonb;

create or replace function public.infinitum_registrar_atendimento(
 p_processo_id bigint,p_descricao text,p_proximo_retorno date,
 p_contato_confirmado boolean,p_idempotency_key uuid
)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
 v_empresa uuid;
 v_usuario record;
 v_processo public.processos%rowtype;
 v_existing record;
 v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
 v_evento uuid;
 v_request jsonb;
 v_snapshot jsonb;
 v_next date;
begin
 v_empresa := public.get_user_empresa_id();
 if (select auth.uid()) is null or v_empresa is null then
  raise exception 'Sessão de empresa inválida' using errcode='42501';
 end if;
 if p_idempotency_key is null then
  raise exception 'Identificador da tentativa é obrigatório';
 end if;
 select nome,auth_user_id into v_usuario from public.usuarios
 where auth_user_id=(select auth.uid()) and empresa_id=v_empresa limit 1;
 if v_usuario.auth_user_id is null or length(trim(coalesce(v_usuario.nome,'')))<2 then
  raise exception 'Usuário não pertence à organização ativa' using errcode='42501';
 end if;
 if length(trim(coalesce(p_descricao,'')))<3 or length(p_descricao)>3000 then
  raise exception 'Descrição do atendimento deve ter de 3 a 3000 caracteres';
 end if;
 if p_processo_id is null then
  raise exception 'Selecione um processo vinculado ao atendimento';
 end if;
 -- A mesma linha fica estável até o fim da transação, inclusive quando o
 -- próximo retorno é preservado em vez de ser informado pelo operador.
 select * into v_processo from public.processos
 where id=p_processo_id and empresa_id=v_empresa for update;
 if not found then
  raise exception 'Processo não encontrado ou edição sem permissão' using errcode='42501';
 end if;
 v_next := coalesce(p_proximo_retorno,v_processo.proximo_retorno);
 v_request := jsonb_build_object('processo_id',p_processo_id,
  'descricao',trim(p_descricao),'proximo_retorno',p_proximo_retorno,
  'contato_confirmado',coalesce(p_contato_confirmado,false));
 v_snapshot := jsonb_build_object('request',v_request,'next_return',v_next,'actor_name',v_usuario.nome);

 -- Continua reservando o evento antes da alteração. A auditoria não requer
 -- UPDATE e a função permanece sob as políticas RLS e permissões existentes.
 insert into public.tarefas_realizadas(
  empresa_id,responsavel_auth_user_id,titulo,descricao,categoria,data_realizacao,
  protocolo_ref,processo_id,contato_cliente_confirmado,origem,
  attendance_request_id,attendance_request_payload
 ) values(
  v_empresa,v_usuario.auth_user_id,'Atendimento registrado pelo Infinitum',
  trim(p_descricao),'atendimento',v_dia,v_processo.protocolo_ref,p_processo_id,
  coalesce(p_contato_confirmado,false),'infinitum',p_idempotency_key,v_snapshot
 ) on conflict (empresa_id,responsavel_auth_user_id,attendance_request_id)
  where attendance_request_id is not null do nothing returning id into v_evento;

 if v_evento is null then
  select id,processo_id,data_realizacao,attendance_request_payload into v_existing
  from public.tarefas_realizadas where empresa_id=v_empresa
   and responsavel_auth_user_id=v_usuario.auth_user_id
   and attendance_request_id=p_idempotency_key;
  -- Eventos legados sem snapshot não recebem um recibo inventado a partir
  -- do estado atual do processo. Nenhuma tentativa é repetida como nova.
  if v_existing.id is null or v_existing.processo_id is distinct from p_processo_id
   or v_existing.attendance_request_payload->'request' is distinct from v_request then
   raise exception 'Esta tentativa já existe com dados diferentes ou sem recibo verificável. Consulte o histórico.' using errcode='23505';
  end if;
  return jsonb_build_object('ok',true,'idempotent',true,'evento_id',v_existing.id,
   'processo_id',p_processo_id,'ultimo_atendimento',v_existing.data_realizacao,
   'proximo_atendimento',v_existing.attendance_request_payload->'next_return',
   'responsavel',v_existing.attendance_request_payload->>'actor_name',
   'responsavel_id',v_usuario.auth_user_id);
 end if;

 update public.processos set ultimo_retorno=v_dia,proximo_retorno=v_next,
  atendido_por=v_usuario.nome,updated_at=now()
 where id=p_processo_id and empresa_id=v_empresa returning * into v_processo;
 if not found then
  raise exception 'Processo não encontrado ou edição sem permissão' using errcode='42501';
 end if;
 return jsonb_build_object('ok',true,'idempotent',false,'evento_id',v_evento,
  'processo_id',p_processo_id,'ultimo_atendimento',v_dia,
  'proximo_atendimento',v_processo.proximo_retorno,'responsavel',v_usuario.nome,
  'responsavel_id',v_usuario.auth_user_id);
end;
$$;
revoke all on function public.infinitum_registrar_atendimento(bigint,text,date,boolean,uuid) from public,anon;
grant execute on function public.infinitum_registrar_atendimento(bigint,text,date,boolean,uuid) to authenticated;
reset lock_timeout;
reset statement_timeout;
