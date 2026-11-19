import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(
  new URL('../supabase/lexis-primary/20261119073000_harden_is_superadmin_exact_role.sql', import.meta.url),
  'utf8',
);

test('superadmin helper accepts only an exact normalized role', () => {
  const definition = sql.slice(sql.toLowerCase().indexOf('create or replace function'));
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.is_superadmin\(\)/i);
  assert.match(
    sql,
    /lower\s*\(\s*btrim\s*\(\s*coalesce\s*\(\s*u\.role,\s*''\s*\)\s*\)\s*\)\s*=\s*'superadmin'/i,
  );
  assert.match(
    sql,
    /lower\s*\(\s*btrim\s*\(\s*coalesce\s*\(\s*u\.cargo::text,\s*''\s*\)\s*\)\s*\)\s*=\s*'superadmin'/i,
  );
  assert.doesNotMatch(definition, /ilike\s+'%superadmin%'/i);
  assert.match(sql, /set\s+search_path\s+to\s+'pg_catalog',\s*'public',\s*'pg_temp'/i);
  assert.doesNotMatch(sql, /(?:delete|update|insert|truncate|drop)\s+/i);
});
