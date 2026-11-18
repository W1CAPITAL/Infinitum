import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(
  new URL('../supabase/lexis-primary/20261118220500_revoke_office_agent_trigger_rpc.sql', import.meta.url),
  'utf8',
);

test('trigger-only office memory cap is not exposed as a client RPC', () => {
  assert.match(sql, /p\.prorettype\s*=\s*'pg_catalog\.trigger'::pg_catalog\.regtype/i);
  assert.match(
    sql,
    /revoke\s+execute\s+on\s+function\s+public\.office_agent_memory_cap\(\)\s+from\s+public,\s*anon,\s*authenticated/i,
  );
  assert.match(
    sql,
    /grant\s+execute\s+on\s+function\s+public\.office_agent_memory_cap\(\)\s+to\s+service_role/i,
  );
  assert.doesNotMatch(sql, /grant\s+execute[\s\S]*?to\s+(?:public|anon|authenticated)\b/i);
});
