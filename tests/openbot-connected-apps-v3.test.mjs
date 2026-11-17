import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('integration hub groups Google Workspace, Instagram and WhatsApp without faking connection',()=>{
 const s=read('lib/openbot-connectors.mjs');
 for(const id of ['drive','sheets','gmail','instagram','whatsapp','crm','github','outlook'])assert.match(s,new RegExp("id:'"+id+"'"));
 assert.match(s,/provider:'google'/);
 assert.match(s,/configured:/);
 assert.match(s,/authorizationUrl/);
});
test('integration status API checks user identity and never returns tokens',()=>{
 const s=read('app/api/openbot/integrations/route.js');
 assert.match(s,/officeAuth/);
 assert.match(s,/openbot_connections/);
 assert.match(s,/owner_id/);
 assert.doesNotMatch(s,/provider_refresh_token|access_token.*Response\.json/);
});
test('OAuth callback must use encrypted state and persist encrypted tokens only',()=>{
 const s=read('app/api/openbot/integrations/oauth/callback/route.js');
 assert.match(s,/decryptOAuthState/);
 assert.match(s,/used_at/);
 assert.match(s,/encryptToken/);
 assert.match(s,/openbot_connections/);
 assert.doesNotMatch(s,/NEXT_PUBLIC_.*SECRET/);
});
test('connected apps UI has provider cards, consent, CRM native and desktop WhatsApp',()=>{
 const s=read('components/openbot-connected-apps.jsx');
 assert.match(s,/Google Drive/);
 assert.match(s,/Google Sheets/);
 assert.match(s,/Gmail/);
 assert.match(s,/Instagram/);
 assert.match(s,/WhatsApp/);
 assert.match(s,/CRM/);
 assert.match(s,/openZapFast/);
 assert.match(s,/conectar|Conectar/);
});
test('desktop uses the production CRM identity and secure remote relay',()=>{
 const policy=read('desktop/runtime-policy.mjs');
 const main=read('desktop/main.mjs');
 const server=read('app/api/openbot/relay/route.js');
 assert.match(policy,/segjskjlbeydlljnefai\.supabase\.co/);
 assert.match(policy,/NEXT_PUBLIC_LEXIS_SHARED_DB:'1'/);
 assert.match(main,/functions\/v1\/infinitum-desktop-config/);
 assert.doesNotMatch(main,/agentinfinitum\.vercel\.app/);
 assert.match(server,/process\.env\.OPENBOT_DESKTOP_REMOTE/);
 assert.doesNotMatch(server,/agentinfinitum\.vercel\.app/);
 assert.match(server,/officeAuth/);
 assert.match(server,/\/api\/superagente/);
 assert.match(server,/\/api\/openbot\/integrations/);
});
test('CRM direct lookup is user-scoped and read-only',()=>{
 const s=read('app/api/openbot/crm/search/route.js');
 assert.match(s,/officeAuth/);
 assert.match(s,/office_cases/);
 assert.match(s,/office_clients/);
 assert.match(s,/owner_id/);
 assert.doesNotMatch(s,/\.insert\(|\.update\(|\.delete\(/);
});
