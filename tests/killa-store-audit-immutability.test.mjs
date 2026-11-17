import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('the store audit trail cannot be rewritten using the service role',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261116_killa_store_audit_append_only.sql',import.meta.url),'utf8');
 assert.match(sql,/REVOKE UPDATE, DELETE, TRUNCATE.*service_role/);
 assert.match(sql,/BEFORE UPDATE OR DELETE/);
 assert.match(sql,/RAISE EXCEPTION/);
});
