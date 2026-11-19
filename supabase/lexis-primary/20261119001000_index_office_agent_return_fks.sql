-- Cover the foreign-key lookup paths used to reconcile return receipts.
-- Existing tenant-scoped indexes start with empresa_id and cannot cover these
-- relationships when PostgreSQL validates or joins by the referenced id alone.
create index if not exists office_agent_return_records_processo_id_idx
  on public.office_agent_return_records (processo_id);

create index if not exists office_agent_return_records_reply_event_id_idx
  on public.office_agent_return_records (reply_event_id);
