import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encryptToken,decryptToken,encryptOAuthState,decryptOAuthState} from '../lib/openbot-connection-server.mjs';
import {connectorCatalog,authorizationUrl} from '../lib/openbot-connectors.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const env={OPENBOT_TOKEN_CIPHER_KEY:Buffer.alloc(32,47).toString('base64url')};

test('OAuth tokens use authenticated encryption; plaintext and tampering never work',()=>{
 const sealed=encryptToken({access_token:'private-access',refresh_token:'private-refresh'},env);
 assert.doesNotMatch(sealed,/private-(?:access|refresh)/);
 assert.deepEqual(decryptToken(sealed,env),{access_token:'private-access',refresh_token:'private-refresh'});
 const bits=sealed.split('.');bits[3]=(bits[3].startsWith('A')?'B':'A')+bits[3].slice(1);
 assert.throws(()=>decryptToken(bits.join('.'),env),/expirou|alterada/);
});
test('OAuth state expires after ten minutes, not reusable beyond expiry',()=>{
 const sealed=encryptOAuthState({nonce:'nonce',ownerId:'owner',provider:'google'},env);
 const current=decryptOAuthState(sealed,env);
 assert.equal(current.provider,'google');
 const old=encryptToken({purpose:'openbot-oauth',nonce:'nonce',ownerId:'owner',provider:'google',issued:Date.now()-11*60_000},env);
 assert.throws(()=>decryptOAuthState(old,env),/expirada/);
});
test('Google OAuth requests read-only scopes, PKCE and exact approved callback',()=>{
 const url=new URL(authorizationUrl('google',{
  clientId:'public-demo',redirectUri:'https://agentinfinitum.vercel.app/api/openbot/integrations/oauth/callback',
  state:'sealed',challenge:'pkce',connectorId:'gmail'
 }));
 assert.equal(url.hostname,'accounts.google.com');
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 assert.match(url.searchParams.get('scope'),/gmail\.readonly/);
 assert.doesNotMatch(url.searchParams.get('scope'),/drive\.metadata\.readonly|spreadsheets\.readonly|calendar\.events\.readonly/);
 assert.doesNotMatch(url.searchParams.get('scope'),/gmail\.send|drive\.file|spreadsheets\.write|calendar\.events(?:\s|$)/);
});
test('never label unconfigured providers as connected',()=>{
 const c=connectorCatalog({});
 assert.equal(c.find(x=>x.id==='drive').configured,false);
 assert.equal(c.find(x=>x.id==='gmail').state,'requires_app_configuration');
 assert.equal(c.find(x=>x.id==='instagram').configured,false);
 assert.equal(c.find(x=>x.id==='whatsapp').state,'requires_app_configuration');
  assert.equal(c.find(x=>x.id==='whatsapp').mode,'composio');
  assert.equal(c.find(x=>x.id==='zapfast').state,'separate');
 assert.equal(c.find(x=>x.id==='crm').state,'native');
});
test('MausBot remote HTTP MCP implements standard read-only JSON RPC',()=>{
 const s=read('app/api/openbot/mcp/route.js');
 assert.match(s,/notifications\/initialized/);
 assert.match(s,/tools\/list/);
 assert.match(s,/tools\/call/);
 assert.match(s,/protocolVersion/);
 assert.match(s,/openbot_mcp_grants/);
 assert.match(s,/officeAuth\(request,\{allowOAuth:true\}\)/);
 assert.match(s,/\.insert\(/); // Only inserts proposals for human review.
 assert.doesNotMatch(s,/\.update\(|\.delete\(/);
 const meta=read('app/.well-known/oauth-protected-resource/api/openbot/mcp/route.js');
 assert.match(meta,/authorization_servers/);
});
test('User may approve MausBot client directly in OAuth consent after MFA',()=>{
 const s=read('app/oauth/consent/page.jsx');
 assert.match(s,/confirmNewClient/);
 assert.match(s,/getAuthenticatorAssuranceLevel/);
 assert.match(s,/openbot_mcp_grants/);
 assert.match(s,/approveAuthorization/);
 assert.match(s,/denyAuthorization/);
 const sql=read('supabase/migrations/20261117092000_openbot_mcp_require_mfa.sql');
 assert.match(sql,/aal2/);
 assert.match(sql,/AS RESTRICTIVE/);
});
test('Windows app does not carry server secrets or allow arbitrary proxying',()=>{
 const p=read('desktop/runtime-policy.mjs');
 assert.match(p,/OPENBOT_DESKTOP_REMOTE:'https:\/\/agentinfinitum\.vercel\.app'/);
 assert.match(p,/NEXT_PUBLIC_LEXIS_SHARED_DB:'1'/);
 const relay=read('app/api/openbot/relay/route.js');
 assert.match(relay,/READABLE=new Set/);
 assert.match(relay,/WRITABLE=new Set/);
 assert.match(relay,/officeAuth\(request\)/);
 assert.match(relay,/redirect:'error'/);
 assert.doesNotMatch(relay,/SUPABASE_SERVICE_ROLE_KEY/);
});
