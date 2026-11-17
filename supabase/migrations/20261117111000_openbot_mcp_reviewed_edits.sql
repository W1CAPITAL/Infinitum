-- External MCP clients can propose controlled edits; only the signed-in human with MFA
-- can approve and atomically apply them. No outbound messages, deletes or legal status changes.
ALTER TABLE public.openbot_mcp_grants
 ADD COLUMN IF NOT EXISTS edit_scope text NOT NULL DEFAULT 'read'
 CHECK(edit_scope IN ('read','reviewed_edit'));

CREATE TABLE IF NOT EXISTS public.openbot_mcp_edit_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 empresa_id uuid NOT NULL,
 client_id text NOT NULL CHECK(length(client_id) BETWEEN 5 AND 200),
 target_table text NOT NULL CHECK(target_table IN ('office_clients','office_cases','office_deadlines','crm_clients')),
 target_id uuid NOT NULL,
 field_name text NOT NULL CHECK(length(field_name) BETWEEN 3 AND 40),
 new_value text NOT NULL CHECK(length(new_value) BETWEEN 1 AND 2400),
 reason text NOT NULL CHECK(length(reason) BETWEEN 12 AND 480),
 expected_updated_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','rejected','conflict')),
 original_value text,
 applied_value text,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '30 minutes'),
 reviewed_at timestamptz,
 reviewed_by uuid REFERENCES auth.users(id),
 CONSTRAINT openbot_edit_time_cap CHECK(expires_at>created_at AND expires_at<=created_at+interval '31 minutes')
);
CREATE INDEX IF NOT EXISTS openbot_mcp_edits_pending_idx
 ON public.openbot_mcp_edit_requests(owner_id,status,created_at DESC);

ALTER TABLE public.openbot_mcp_edit_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.openbot_mcp_edit_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.openbot_mcp_edit_requests TO authenticated;
DROP POLICY IF EXISTS openbot_mcp_edits_own_read ON public.openbot_mcp_edit_requests;
DROP POLICY IF EXISTS openbot_mcp_edits_oauth_propose ON public.openbot_mcp_edit_requests;
CREATE POLICY openbot_mcp_edits_own_read ON public.openbot_mcp_edit_requests
 FOR SELECT TO authenticated USING(owner_id=(select auth.uid()));
CREATE POLICY openbot_mcp_edits_oauth_propose ON public.openbot_mcp_edit_requests
 FOR INSERT TO authenticated WITH CHECK(
  owner_id=(select auth.uid())
  AND coalesce((select auth.jwt())->>'client_id','')=client_id
  AND status='pending' AND original_value IS NULL AND applied_value IS NULL
  AND reviewed_by IS NULL AND reviewed_at IS NULL
  AND exists(
    SELECT 1 FROM public.usuarios u
    WHERE u.auth_user_id=(select auth.uid()) AND u.empresa_id=openbot_mcp_edit_requests.empresa_id
  )
  AND exists(
    SELECT 1 FROM public.openbot_mcp_grants g
    WHERE g.owner_id=(select auth.uid()) AND g.client_id=openbot_mcp_edit_requests.client_id
      AND g.enabled AND g.edit_scope='reviewed_edit' AND g.expires_at>now()
  )
);

-- This function is the ONLY write path. It checks company/owner, single-use approval,
-- the original updated_at, the field allowlist, and the MFA assurance level.
CREATE OR REPLACE FUNCTION public.openbot_review_mcp_edit(p_id uuid,p_approve boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
 p public.openbot_mcp_edit_requests%ROWTYPE;
 actor uuid:=auth.uid();
 claims jsonb:=auth.jwt();
 membership_count integer;
 member_company uuid;
 before_row jsonb;
 after_row jsonb;
 allowed boolean;
 is_date boolean;
BEGIN
 IF actor IS NULL OR coalesce(claims->>'client_id','')<>'' OR coalesce(claims->>'aal','')<>'aal2'
 THEN RAISE EXCEPTION 'É necessária uma sessão humana com MFA AAL2.' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.openbot_mcp_edit_requests
 WHERE id=p_id AND owner_id=actor AND status='pending'
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposta inexistente ou já revisada.' USING ERRCODE='42501'; END IF;
 IF p.expires_at<=now() THEN RAISE EXCEPTION 'Proposta expirada; solicite outra.' USING ERRCODE='22023'; END IF;
 SELECT count(*),min(empresa_id::text)::uuid INTO membership_count,member_company
 FROM public.usuarios WHERE auth_user_id=actor;
 IF membership_count<>1 OR member_company IS DISTINCT FROM p.empresa_id
 THEN RAISE EXCEPTION 'Vínculo empresarial não autorizado.' USING ERRCODE='42501'; END IF;
 IF p_approve IS NULL THEN RAISE EXCEPTION 'Decisão de revisão inválida.' USING ERRCODE='22023'; END IF;
 IF NOT p_approve THEN
  UPDATE public.openbot_mcp_edit_requests SET status='rejected',reviewed_at=now(),reviewed_by=actor WHERE id=p.id;
  RETURN jsonb_build_object('ok',true,'status','rejected','id',p.id);
 END IF;
 -- An approved client must STILL have an active, explicitly granted edit scope.
 IF NOT EXISTS (SELECT 1 FROM public.openbot_mcp_grants g WHERE g.owner_id=actor
  AND g.client_id=p.client_id AND g.enabled AND g.edit_scope='reviewed_edit' AND g.expires_at>now())
 THEN RAISE EXCEPTION 'A permissão MCP de edição expirou ou foi revogada.' USING ERRCODE='42501'; END IF;
 allowed:=CASE p.target_table
  WHEN 'office_clients' THEN p.field_name IN ('notes','next_return','responsible')
  WHEN 'office_cases' THEN p.field_name IN ('notes','next_review')
  WHEN 'office_deadlines' THEN p.field_name IN ('notes','responsible','priority')
  WHEN 'crm_clients' THEN p.field_name IN ('notes','next_return','assigned_to','priority_level')
  ELSE false END;
 IF NOT allowed THEN RAISE EXCEPTION 'Campo não permitido pelo MCP.' USING ERRCODE='22023'; END IF;
 is_date:=p.field_name IN ('next_return','next_review');
 IF is_date THEN
  IF p.new_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  THEN RAISE EXCEPTION 'Data inválida.' USING ERRCODE='22023'; END IF;
  PERFORM p.new_value::date; -- let PostgreSQL reject out-of-range dates
 ELSIF p.field_name IN ('responsible','assigned_to','priority','priority_level') THEN
  IF length(p.new_value)>100 OR p.new_value ~ '[[:cntrl:]]'
  THEN RAISE EXCEPTION 'Valor inválido para campo curto.' USING ERRCODE='22023'; END IF;
 ELSE
  IF length(p.new_value)>2400
  THEN RAISE EXCEPTION 'Observação muito longa.' USING ERRCODE='22023'; END IF;
 END IF;
 -- Rows are locked before the compare-and-update to prevent lost updates.
 CASE p.target_table
 WHEN 'office_clients' THEN
  SELECT to_jsonb(t) INTO before_row FROM public.office_clients t
    WHERE t.id=p.target_id AND t.owner_id=actor AND t.empresa_id=p.empresa_id FOR UPDATE;
 WHEN 'office_cases' THEN
  SELECT to_jsonb(t) INTO before_row FROM public.office_cases t
    WHERE t.id=p.target_id AND t.owner_id=actor AND t.empresa_id=p.empresa_id FOR UPDATE;
 WHEN 'office_deadlines' THEN
  SELECT to_jsonb(t) INTO before_row FROM public.office_deadlines t
    WHERE t.id=p.target_id AND t.owner_id=actor AND t.empresa_id=p.empresa_id FOR UPDATE;
 WHEN 'crm_clients' THEN
  SELECT to_jsonb(t) INTO before_row FROM public.crm_clients t
    WHERE t.id=p.target_id AND t.empresa_id=p.empresa_id FOR UPDATE;
 END CASE;
 IF before_row IS NULL THEN RAISE EXCEPTION 'Registro não encontrado na empresa autorizada.' USING ERRCODE='42501'; END IF;
 IF (before_row->>'updated_at')::timestamptz IS DISTINCT FROM p.expected_updated_at THEN
  UPDATE public.openbot_mcp_edit_requests SET status='conflict',reviewed_at=now(),reviewed_by=actor
   WHERE id=p.id;
  RETURN jsonb_build_object('ok',false,'status','conflict','id',p.id,
   'reason','Registro mudou desde a proposta; faça uma nova consulta.');
 END IF;
 CASE p.target_table
 WHEN 'office_clients' THEN
  UPDATE public.office_clients t
   SET notes=CASE WHEN p.field_name='notes' THEN p.new_value ELSE t.notes END,
       next_return=CASE WHEN p.field_name='next_return' THEN p.new_value::date ELSE t.next_return END,
       responsible=CASE WHEN p.field_name='responsible' THEN p.new_value ELSE t.responsible END,
       updated_at=now()
   WHERE t.id=p.target_id AND t.owner_id=actor AND t.empresa_id=p.empresa_id
   RETURNING to_jsonb(t) INTO after_row;
 WHEN 'office_cases' THEN
  UPDATE public.office_cases t
   SET notes=CASE WHEN p.field_name='notes' THEN p.new_value ELSE t.notes END,
       next_review=CASE WHEN p.field_name='next_review' THEN p.new_value::date ELSE t.next_review END,
       updated_at=now()
   WHERE t.id=p.target_id AND t.owner_id=actor AND t.empresa_id=p.empresa_id
   RETURNING to_jsonb(t) INTO after_row;
 WHEN 'office_deadlines' THEN
  UPDATE public.office_deadlines t
   SET notes=CASE WHEN p.field_name='notes' THEN p.new_value ELSE t.notes END,
       responsible=CASE WHEN p.field_name='responsible' THEN p.new_value ELSE t.responsible END,
       priority=CASE WHEN p.field_name='priority' THEN p.new_value ELSE t.priority END,
       updated_at=now()
   WHERE t.id=p.target_id AND t.owner_id=actor AND t.empresa_id=p.empresa_id
   RETURNING to_jsonb(t) INTO after_row;
 WHEN 'crm_clients' THEN
  UPDATE public.crm_clients t
   SET notes=CASE WHEN p.field_name='notes' THEN p.new_value ELSE t.notes END,
       next_return=CASE WHEN p.field_name='next_return' THEN p.new_value::date ELSE t.next_return END,
       assigned_to=CASE WHEN p.field_name='assigned_to' THEN p.new_value ELSE t.assigned_to END,
       priority_level=CASE WHEN p.field_name='priority_level' THEN p.new_value ELSE t.priority_level END,
       updated_at=now()
   WHERE t.id=p.target_id AND t.empresa_id=p.empresa_id
   RETURNING to_jsonb(t) INTO after_row;
 END CASE;
 IF after_row IS NULL THEN RAISE EXCEPTION 'A alteração não foi confirmada.' USING ERRCODE='P0001'; END IF;
 UPDATE public.openbot_mcp_edit_requests
 SET status='applied',original_value=before_row->>p.field_name,applied_value=after_row->>p.field_name,
     reviewed_at=now(),reviewed_by=actor
 WHERE id=p.id;
 RETURN jsonb_build_object('ok',true,'status','applied','id',p.id,'table',p.target_table,
   'field',p.field_name,'previous',before_row->>p.field_name,'current',after_row->>p.field_name);
END;
$$;
REVOKE ALL ON FUNCTION public.openbot_review_mcp_edit(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.openbot_review_mcp_edit(uuid,boolean) TO authenticated;
