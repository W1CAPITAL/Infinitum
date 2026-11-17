import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('company policy write RLS recognizes protected Lexis cargo Superadmin and Administrator',()=>{
 const migration=read('supabase/migrations/20261116180000_fix_openbot_company_admin_cargo_rls.sql');
 assert.match(migration,/office_agent_company_write/);
 assert.match(migration,/u\.cargo/i);
 assert.match(migration,/superadmin/i);
 assert.match(migration,/administrador/i);
});

test('company policy write RLS remains restricted to the authenticated user company',()=>{
 const migration=read('supabase/migrations/20261116180000_fix_openbot_company_admin_cargo_rls.sql');
 assert.match(migration,/get_user_empresa_id\(\)/);
 assert.match(migration,/u\.auth_user_id\s*=\s*\(select auth\.uid\(\)\)/i);
 assert.match(migration,/u\.empresa_id\s*=\s*office_agent_company_policies\.empresa_id/i);
 assert.match(migration,/updated_by\s*=\s*\(select auth\.uid\(\)\)/i);
});

test('MCP consent requires AAL2 and prior client approval or explicit new-client consent',()=>{
 const page=read('app/oauth/consent/page.jsx');
 assert.match(page,/approvedClients\.includes\(clientId\)/);
 assert.match(page,/currentLevel==='aal2'/);
 assert.match(page,/disabled=\{busy\|\|!mfaOk\|\|\(!clientApproved&&!confirmNewClient\)\}/);
 assert.match(page,/openbot_mcp_grants/);
 const rls=read('supabase/migrations/20261117092000_openbot_mcp_require_mfa.sql');
 assert.match(rls,/aal2/);
});
