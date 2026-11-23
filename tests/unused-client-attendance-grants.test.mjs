import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(
  new URL(
    '../supabase/lexis-primary/20261123001500_revoke_unused_client_attendance_rpc.sql',
    import.meta.url,
  ),
  'utf8',
);

test('legacy client attendance command is removed from the authenticated RPC surface', () => {
  assert.match(
    sql,
    /revoke\s+execute\s+on\s+function\s+public\.infinitum_registrar_atendimento_cliente\(uuid,text,date,boolean\)\s+from\s+public,\s*anon,\s*authenticated/i,
  );
  assert.match(
    sql,
    /grant\s+execute\s+on\s+function\s+public\.infinitum_registrar_atendimento_cliente\(uuid,text,date,boolean\)\s+to\s+service_role/i,
  );
});

test('migration fails closed when a database dependency exists', () => {
  assert.match(sql, /pg_catalog\.pg_policies/i);
  assert.match(sql, /information_schema\.columns/i);
  assert.match(sql, /pg_catalog\.pg_views/i);
  assert.match(sql, /pg_catalog\.pg_get_functiondef/i);
  assert.match(sql, /pg_catalog\.pg_depend/i);
  assert.match(sql, /client attendance rpc still has dependencies/i);
});

test('migration changes grants only and never mutates operational data', () => {
  assert.doesNotMatch(sql, /\b(?:delete|update|insert|truncate|drop)\s+/i);
  assert.doesNotMatch(
    sql,
    /grant\s+execute[\s\S]*?to\s+(?:public|anon|authenticated)\b/i,
  );
});
