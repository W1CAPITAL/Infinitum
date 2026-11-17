-- Version-controlled snapshot of service-only RPCs already applied on the native Supabase project.
-- Anon/authenticated MUST NOT call these privileged functions.
CREATE OR REPLACE FUNCTION public.killa_store_admin_access(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a record;
begin
 select s.enabled,s.store_mcp_enabled,s.diagnostics_enabled into a
 from killa_private.killa_store_superadmins s
 join public.crm_memberships m on m.user_id=s.user_id and m.role='admin' and m.enabled is true
 where s.user_id=p_user_id and s.enabled is true;
 if not found then return jsonb_build_object('allowed',false); end if;
 return jsonb_build_object('allowed',true,'storeMcpEnabled',a.store_mcp_enabled,'diagnosticsEnabled',a.diagnostics_enabled);
end $function$
;

CREATE OR REPLACE FUNCTION public.killa_store_audit_summary(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if (public.killa_store_admin_access(p_user_id)->>'allowed')::boolean is distinct from true then
  raise exception 'forbidden' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'action',q.action,'date',q.created_at,
 'requestId',q.request_id,'details',q.summary) order by q.created_at desc),'[]'::jsonb) into result
 from (select id,action,created_at,request_id,summary from killa_private.killa_store_audit order by id desc limit 40) q;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.killa_store_claim_release(p_user_id uuid, p_request_id uuid, p_version text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q record;
begin
 if (public.killa_store_admin_access(p_user_id)->>'allowed')::boolean is distinct from true then
  raise exception 'forbidden' using errcode='42501';
 end if;
 update killa_private.killa_store_release_requests
 set status='dispatching',reviewed_at=now(),reviewed_by=p_user_id
 where id=p_request_id and version=p_version and status='pending' and expires_at>now()
 returning id,version,actor_id into q;
 if not found then raise exception 'expired_or_already_processed' using errcode='23514';end if;
 insert into killa_private.killa_store_audit(actor_id,action,request_id,summary)
 values(p_user_id,'release_dispatch_claimed',p_request_id,jsonb_build_object('version',q.version));
 return jsonb_build_object('id',q.id,'version',q.version);
end $function$
;

CREATE OR REPLACE FUNCTION public.killa_store_complete_release(p_user_id uuid, p_request_id uuid, p_success boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (public.killa_store_admin_access(p_user_id)->>'allowed')::boolean is distinct from true then
  raise exception 'forbidden' using errcode='42501';
 end if;
 update killa_private.killa_store_release_requests
 set status=case when p_success then 'dispatched' else 'uncertain' end
 where id=p_request_id and status='dispatching';
 if not found then raise exception 'already_processed' using errcode='23514';end if;
 insert into killa_private.killa_store_audit(actor_id,action,request_id,summary)
 values(p_user_id,'release_dispatch_result',p_request_id,jsonb_build_object('dispatched',p_success));
 return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.killa_store_request_release(p_user_id uuid, p_version text, p_rationale text, p_client_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result_id uuid; cfg jsonb;
begin
 cfg:=public.killa_store_admin_access(p_user_id);
 if (cfg->>'allowed')::boolean is distinct from true then
  raise exception 'forbidden' using errcode='42501';
 end if;
 if p_client_id is not null and (cfg->>'storeMcpEnabled')::boolean is distinct from true then
  raise exception 'mcp_disabled' using errcode='42501';
 end if;
 if p_version !~ '^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$'
 or length(coalesce(p_rationale,'')) not between 3 and 500
 or length(coalesce(p_client_id,''))>128 then
  raise exception 'invalid_request' using errcode='22023';
 end if;
 insert into killa_private.killa_store_release_requests(actor_id,oauth_client_id,version,rationale)
 values (p_user_id,p_client_id,p_version,p_rationale)
 returning id into result_id;
 insert into killa_private.killa_store_audit(actor_id,action,request_id,summary)
 values (p_user_id,'release_requested',result_id,jsonb_build_object('version',p_version,'viaMcp',p_client_id is not null));
 return result_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.killa_store_requests(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if (public.killa_store_admin_access(p_user_id)->>'allowed')::boolean is distinct from true then
  raise exception 'forbidden' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',q.id,'version',q.version,'status',q.status,'createdAt',q.created_at,
 'expiresAt',q.expires_at,'viaMcp',q.oauth_client_id is not null,'reason',left(q.rationale,180)
 ) order by q.created_at desc),'[]'::jsonb) into result
 from (select * from killa_private.killa_store_release_requests order by created_at desc limit 18) q;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.killa_store_toggle_mcp(p_user_id uuid, p_enabled boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (public.killa_store_admin_access(p_user_id)->>'allowed')::boolean is distinct from true then
  raise exception 'forbidden' using errcode='42501';
 end if;
 update killa_private.killa_store_superadmins set store_mcp_enabled=p_enabled where user_id=p_user_id;
 insert into killa_private.killa_store_audit(actor_id,action,summary)
 values (p_user_id,'store_mcp_toggled',jsonb_build_object('enabled',p_enabled));
 return true;
end $function$
;

REVOKE ALL ON FUNCTION public.killa_store_admin_access(uuid),
 public.killa_store_toggle_mcp(uuid,boolean),
 public.killa_store_request_release(uuid,text,text,text),
 public.killa_store_requests(uuid),
 public.killa_store_audit_summary(uuid),
 public.killa_store_claim_release(uuid,uuid,text),
 public.killa_store_complete_release(uuid,uuid,boolean)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.killa_store_admin_access(uuid),
 public.killa_store_toggle_mcp(uuid,boolean),
 public.killa_store_request_release(uuid,text,text,text),
 public.killa_store_requests(uuid),
 public.killa_store_audit_summary(uuid),
 public.killa_store_claim_release(uuid,uuid,text),
 public.killa_store_complete_release(uuid,uuid,boolean)
 TO service_role;
