-- Killa Desktop Realtime: publish owner-specific live archive and MCP receipts only.
-- Applies only to the native INFINITUM project; all three tables have RLS SELECT
-- policies scoped to auth.uid() as owner_id.
DO $killa$
DECLARE t text;
BEGIN
 FOR t IN SELECT unnest(ARRAY[
  'office_wa_chat_archive',
  'office_wa_message_archive',
  'killa_mcp_send_intents'
 ]) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables
   WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
   EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
  END IF;
 END LOOP;
END $killa$;
-- DELETE payloads are intentionally excluded because Postgres Changes RLS
-- authorization is not equivalent for deleted rows.
ALTER PUBLICATION supabase_realtime SET (publish='insert,update');
