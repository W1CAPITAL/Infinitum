-- Search is scoped by current authenticated company's RLS.
-- Normalize punctuation in profile display names and phone strings before matching.
CREATE OR REPLACE FUNCTION public.find_openbot_process_candidates(p_label text,p_phone text)
RETURNS TABLE(id bigint,cliente text,telefone text,protocolo_ref text,status text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 WITH needle AS (
  SELECT right(regexp_replace(left(coalesce(p_phone,''),30),'[^0-9]','','g'),10) AS phone,
         left(lower(coalesce(p_label,'')),110) AS label
 ), name_pieces AS (
  SELECT btrim(v.part) AS term FROM needle n,
   LATERAL regexp_split_to_table(n.label,'[ /|;–-]+') AS v(part)
  WHERE length(btrim(v.part))>=4 AND btrim(v.part) NOT IN
   ('financeiro','recepcao','secretaria','atendimento','administrativo','administrativa','cliente','contato')
  LIMIT 8
 ), full_pieces AS (
  SELECT btrim(v.part) AS term FROM needle n,
   LATERAL regexp_split_to_table(n.label,'[/|;]| - | – ') AS v(part)
  WHERE length(btrim(v.part))>=5
  LIMIT 5
 )
 SELECT p.id,p.cliente,p.telefone,p.protocolo_ref,p.status
 FROM public.processos p CROSS JOIN needle n
 WHERE p.empresa_id=(SELECT public.get_user_empresa_id())
 AND (
  (length(n.phone)=10 AND right(regexp_replace(coalesce(p.telefone,''),'[^0-9]','','g'),10)=n.phone)
  OR EXISTS(SELECT 1 FROM full_pieces n2 WHERE lower(coalesce(p.cliente,'')) LIKE '%'||n2.term||'%')
  OR EXISTS(SELECT 1 FROM name_pieces n3 WHERE lower(coalesce(p.cliente,'')) LIKE '%'||n3.term||'%')
 )
 ORDER BY
  CASE WHEN length(n.phone)=10 AND right(regexp_replace(coalesce(p.telefone,''),'[^0-9]','','g'),10)=n.phone THEN 0 ELSE 1 END,
  p.id DESC
 LIMIT 35
$$;
REVOKE ALL ON FUNCTION public.find_openbot_process_candidates(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.find_openbot_process_candidates(text,text) TO authenticated;