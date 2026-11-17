-- Protect encrypted provider secrets from browser/third-party OAuth clients:
-- only server-side service credentials can access ciphertext or change tokens.
REVOKE SELECT,INSERT,UPDATE ON public.openbot_connections FROM authenticated;
GRANT SELECT (
 id,owner_id,provider,external_account_id,display_name,email,scopes,
 status,expires_at,last_checked_at,created_at,updated_at
) ON public.openbot_connections TO authenticated;
GRANT DELETE ON public.openbot_connections TO authenticated;
-- OAuth state nonce is write-only to browser sessions; callback requires server admin.
REVOKE SELECT,UPDATE,DELETE ON public.openbot_oauth_states FROM authenticated;
GRANT INSERT ON public.openbot_oauth_states TO authenticated;
