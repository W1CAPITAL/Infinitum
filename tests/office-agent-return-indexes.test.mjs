import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(
  new URL('../supabase/lexis-primary/20261119001000_index_office_agent_return_fks.sql', import.meta.url),
  'utf8',
);

test('return receipt foreign keys have dedicated leading indexes', () => {
  assert.match(
    sql,
    /create\s+index\s+if\s+not\s+exists\s+office_agent_return_records_processo_id_idx\s+on\s+public\.office_agent_return_records\s*\(processo_id\)/i,
  );
  assert.match(
    sql,
    /create\s+index\s+if\s+not\s+exists\s+office_agent_return_records_reply_event_id_idx\s+on\s+public\.office_agent_return_records\s*\(reply_event_id\)/i,
  );
  assert.doesNotMatch(sql, /drop\s+(?:index|table)|delete\s+from|truncate/i);
});
