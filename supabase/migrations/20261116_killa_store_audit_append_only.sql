-- Append-only store audit: service_role may INSERT but never update or delete an existing record.
REVOKE UPDATE, DELETE, TRUNCATE ON killa_private.killa_store_audit FROM service_role,anon,authenticated,PUBLIC;
CREATE OR REPLACE FUNCTION killa_private.prevent_store_audit_rewrite()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'Store audit is append-only' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS killa_audit_append_only ON killa_private.killa_store_audit;
CREATE TRIGGER killa_audit_append_only BEFORE UPDATE OR DELETE
 ON killa_private.killa_store_audit FOR EACH ROW
 EXECUTE FUNCTION killa_private.prevent_store_audit_rewrite();
REVOKE ALL ON FUNCTION killa_private.prevent_store_audit_rewrite() FROM PUBLIC,anon,authenticated;
