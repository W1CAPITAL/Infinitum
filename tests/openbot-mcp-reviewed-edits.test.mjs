import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');

test('MCP offers proposals, not unrestricted editing or automatic WhatsApp sends',()=>{
 const mcp=read('app/api/openbot/mcp/route.js');
 assert.match(mcp,/crm_propose_edit/);
 assert.match(mcp,/edit_scope/);
 assert.match(mcp,/openbot_mcp_edit_requests/);
 assert.doesNotMatch(mcp,/crm_delete_client|whatsapp_send|shell_exec/);
});
test('MCP write proposal validates a strict per-record field allowlist and requires a reason',()=>{
 const rules=read('lib/openbot-mcp-edit-policy.mjs');
 assert.match(rules,/office_clients/);
 assert.match(rules,/office_cases/);
 assert.match(rules,/office_deadlines/);
 assert.match(rules,/crm_clients/);
 assert.match(rules,/notes/);
 assert.match(rules,/next_return/);
 assert.match(rules,/validateEditProposal/);
 assert.match(rules,/reason/);
 assert.doesNotMatch(rules,/service_role|secret_key/);
});
test('Review migration enforces ownership, tenant and single-use atomic changes with MFA',()=>{
 const sql=read('supabase/migrations/20261117111000_openbot_mcp_reviewed_edits.sql');
 assert.match(sql,/openbot_mcp_edit_requests/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.ok(sql.includes('auth.uid()'));
 assert.match(sql,/edit_scope/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/expected_updated_at/);
 assert.match(sql,/RETURNING to_jsonb/);
 assert.match(sql,/aal2/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/owner_id/);
 assert.match(sql,/empresa_id/);
 assert.doesNotMatch(sql,/GRANT\s+EXECUTE[^\n]*\bTO\s+PUBLIC\b/i);
});
test('Only human, MFA-verified app UI can execute or reject proposed changes',()=>{
 const api=read('app/api/openbot/mcp/edits/route.js');
 const ui=read('components/openbot-connected-apps.jsx');
 assert.ok(api.includes('officeAuth(request)'));
 assert.match(api,/openbot_review_mcp_edit/);
 assert.match(api,/aal2/);
 assert.match(ui,/Edições propostas/);
 assert.match(ui,/Aprovar alteração/);
 assert.match(ui,/Rejeitar/);
 assert.match(ui,/editScope|edit_scope/);
});
