import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(
  new URL(
    '../supabase/lexis-primary/20261121104000_revoke_unused_identity_helpers_rpc.sql',
    import.meta.url,
  ),
  'utf8',
);

for (const helper of ['current_usuario', 'meu_empresa_id']) {
  test(`${helper} is removed from the authenticated RPC surface`, () => {
    assert.match(
      sql,
      new RegExp(
        `revoke\\s+execute\\s+on\\s+function\\s+public\\.${helper}\\(\\)\\s+from\\s+public,\\s*anon,\\s*authenticated`,
        'i',
      ),
    );
    assert.match(
      sql,
      new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${helper}\\(\\)\\s+to\\s+service_role`, 'i'),
    );
  });
}

test('migration fails closed when a database dependency exists', () => {
  assert.match(sql, /pg_catalog\.pg_policies/i);
  assert.match(sql, /information_schema\.columns/i);
  assert.match(sql, /pg_catalog\.pg_views/i);
  assert.match(sql, /pg_catalog\.pg_get_functiondef/i);
  assert.match(sql, /legacy identity helper still has dependencies/i);
});

test('migration changes grants only and never mutates operational data', () => {
  assert.doesNotMatch(sql, /\b(?:delete|update|insert|truncate|drop)\s+/i);
  assert.doesNotMatch(sql, /grant\s+execute[\s\S]*?to\s+(?:public|anon|authenticated)\b/i);
});
