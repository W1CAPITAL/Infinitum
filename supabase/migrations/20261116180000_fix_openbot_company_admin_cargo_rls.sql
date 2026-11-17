-- The Lexis company permission is stored in protected usuarios.cargo for several
-- administrator accounts. Keep role support for legacy rows, but do not deny
-- Superadmin/Administrador merely because role is still "operador".
DROP POLICY IF EXISTS office_agent_company_write ON public.office_agent_company_policies;

CREATE POLICY office_agent_company_write
ON public.office_agent_company_policies
FOR ALL TO authenticated
USING (
 empresa_id=(select public.get_user_empresa_id())
 AND EXISTS (
  SELECT 1
  FROM public.usuarios u
  WHERE u.auth_user_id=(select auth.uid())
   AND u.empresa_id=office_agent_company_policies.empresa_id
   AND (
    regexp_replace(lower(coalesce(u.role,'')), '[[:space:]_-]+', '', 'g')
      IN ('admin','administrador','superadmin')
    OR
    regexp_replace(lower(coalesce(u.cargo,'')), '[[:space:]_-]+', '', 'g')
      IN ('admin','administrador','superadmin')
   )
 )
)
WITH CHECK (
 empresa_id=(select public.get_user_empresa_id())
 AND updated_by=(select auth.uid())
 AND EXISTS (
  SELECT 1
  FROM public.usuarios u
  WHERE u.auth_user_id=(select auth.uid())
   AND u.empresa_id=office_agent_company_policies.empresa_id
   AND (
    regexp_replace(lower(coalesce(u.role,'')), '[[:space:]_-]+', '', 'g')
      IN ('admin','administrador','superadmin')
    OR
    regexp_replace(lower(coalesce(u.cargo,'')), '[[:space:]_-]+', '', 'g')
      IN ('admin','administrador','superadmin')
   )
 )
);

COMMENT ON POLICY office_agent_company_write ON public.office_agent_company_policies IS
 'Only authenticated members of this company whose protected role or cargo is Admin, Administrador or Superadmin may change company MCP settings.';

NOTIFY pgrst, 'reload schema';
