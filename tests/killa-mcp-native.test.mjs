import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('native CRM explicitly checks owner membership and never falls back after RLS errors',()=>{
 const s=read('lib/killa-mcp.mjs');
 assert.match(s,/crm_memberships/);
 assert.match(s,/member\.error\.code/);
 assert.match(s,/if\(!missing\)throw err/);
 assert.match(s,/killa_mcp_settings/);
 assert.match(s,/mode:'native'/);
 assert.match(s,/mode==='native'/);
});
test('native WhatsApp archive queries use per-owner scope with no empresa_id column',()=>{
 const s=read('lib/killa-mcp.mjs');
 assert.match(s,/function scoped\(q,company,user\)/);
 assert.match(s,/company\?q\.eq\('empresa_id',company\)\.eq\('owner_id',user\.id\):q\.eq\('owner_id',user\.id\)/);
 assert.doesNotMatch(s,/service_role|createClient\(.+service/);
});
test('native MCP settings require admin and have fail-closed RLS',()=>{
 const sql=read('supabase/migrations/20261116110000_killa_native_mcp_settings.sql');
 assert.match(sql,/row level security/i);
 assert.match(sql,/m\.role='admin'/);
 assert.match(sql,/mcp_enabled boolean not null default false/i);
 assert.match(sql,/revoke all.*anon/i);
 const page=read('app/mcp/setup/page.jsx');
 assert.match(page,/role==='admin'/);
 assert.match(page,/killa_mcp_settings/);
});
