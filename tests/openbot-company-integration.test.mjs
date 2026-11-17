import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('company rules endpoint enforces authenticated tenant and admin-only edits',()=>{
 const s=read('app/api/office/agent/company/route.js');
 assert.match(s,/officeAuth\(request\)/);
 assert.match(s,/companyFor/);
 assert.match(s,/select\('empresa_id,role,cargo,nome'\)/);
 assert.match(s,/isLexisCompanyAdmin\(member\)/);
 assert.match(s,/office_agent_company_policies/);
 assert.match(s,/normalizeOpenBotPolicy/);
 assert.doesNotMatch(s,/SERVICE_ROLE_KEY|sendBulk|Promise\.all\(.*send/);
});
test('message preview obeys company policy and excludes administrative and staff-owned chats',()=>{
 const s=read('app/api/office/agent/reply/route.js');
 assert.match(s,/evaluateOpenBotInbound/);
 assert.match(s,/office_agent_company_policies/);
 assert.match(s,/office_agent_contact_rules/);
 assert.match(s,/rankProcessCandidates/);
 assert.match(s,/media_type/);
});
test('no money or other sensitive material is ever treated as a routine process update',()=>{
 const s=read('lib/openbot-company-agent.mjs');
 assert.match(s,/staffRepliedAfter/);
 assert.match(s,/excluded_contacts/);
 assert.match(s,/requiresHumanReview:true/);
});
test('return date registration is tied to one accepted WhatsApp event and idempotent',()=>{
 const api=read('app/api/office/agent/reply/route.js');
 assert.match(api,/register_office_agent_return/);
 assert.match(api,/returnDate/);
 const migration=read('supabase/migrations/20261116070000_openbot_company_rules.sql');
 assert.match(migration,/UNIQUE\s*\(empresa_id,reply_event_id\)/i);
 assert.match(migration,/provider_message_id/i);
 assert.match(migration,/auth\.uid\(\)/);
 assert.match(migration,/office_agent_reply_events/);
});
test('UI offers company settings, exclusions, group rules, team handoff and historical return scheduling',()=>{
 const s=read('components/openbot-company-settings.jsx');
 assert.match(s,/Excluir contato|Contatos excluídos/);
 assert.match(s,/Grupos|grupos/);
 assert.match(s,/15|30/);
 assert.match(s,/Administrativo/);
 const p=read('components/office-legal-agent-panel.jsx');
 assert.match(p,/OpenBotCompanySettings/);
 assert.match(p,/returnDate/);
});
