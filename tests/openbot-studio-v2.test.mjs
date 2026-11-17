import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('legacy OpenBot chat entry routes into the unified agents workspace',()=>{
 const page=load('app/agentes/chat/page.jsx');
 const center=load('components/agents-command-center.jsx');
 const studio=load('components/openbot-studio.jsx');
 assert.match(page,/redirect/);
 assert.match(center,/OpenBotStudio/);
 assert.match(studio,/Conversa|conversa/);
 assert.match(studio,/Nova conversa/);
 assert.match(studio,/Motor/);
 assert.match(studio,/Histórico|Histórico de/);
 assert.match(studio,/Aprovaç|Revisão/);
 assert.match(studio,/Computador|Ferramentas/);
 assert.doesNotMatch(studio,/enviar WhatsApp automaticamente/i);
});
test('OpenBot reads bots and message histories from per-user Supabase tables',()=>{
 const studio=load('components/openbot-studio.jsx');
 assert.match(studio,/from\('openbot_threads'\)/);
 assert.match(studio,/from\('openbot_messages'\)/);
 assert.match(studio,/const owner=session\?\.user\?\.id/);
 assert.match(studio,/eq\('owner_id',owner\)/);
 assert.match(studio,/\/api\/superagente/);
 assert.match(studio,/externalAiConsent:true/);
 assert.match(studio,/isGenerativeModel/);
});
test('Model list comes from authenticated server configuration, not invented availability',()=>{
 const api=load('app/api/openbot/models/route.js');
 assert.match(api,/officeAuth/);
 assert.match(api,/configuredLexisMotors/);
 assert.doesNotMatch(api,/secret_key|API_KEY.*reply/);
});
test('Private agent conversations have strict ownership and RLS',()=>{
 const sql=load('supabase/migrations/20261117013000_openbot_chat_workspace.sql');
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/gi);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/openbot_threads/);
 assert.match(sql,/openbot_messages/);
 assert.match(sql,/owner_id/);
 assert.match(sql,/client_id/);
});
test('OpenBot and Grok-style bot behavior is grounded in real capabilities',()=>{
 const policy=load('lib/openbot-studio-config.mjs');
 assert.match(policy,/export const OPENBOT_BOTS/);
 assert.match(policy,/manual_review_only/);
 assert.match(policy,/whatsapp/);
 assert.match(policy,/maxHistory/);
});

test('OpenBot never silently predownloads Qwen when opening the standalone messenger',()=>{
 const boot=load('components/qwen-preinstall-bootstrap.jsx');
 assert.match(boot,/pathname==='\/agentes\/chat'\|\|pathname==='\/openbot'/);
 assert.match(boot,/return;/);
});
