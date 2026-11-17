import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('store checks live Supabase Auth session, aal2 and fresh totp before publication',()=>{
 const sql=read('supabase/migrations/20261116_killa_store_live_session.sql');
 assert.match(sql,/auth\.sessions/);
 assert.match(sql,/REVOKE ALL ON FUNCTION .*killa_store_validate_session/);
 const edge=read('supabase/functions/killa-store-admin/index.ts');
 assert.match(edge,/session_revoked/);
 assert.match(edge,/killa_store_validate_session/);
 assert.match(edge,/fresh_totp_required/);
 assert.match(edge,/Math\.abs\(Date\.now\(\)\/1000-m\.timestamp\)<=300/);
 assert.match(edge,/client_id/);
});
