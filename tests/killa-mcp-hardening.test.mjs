import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {jwtClaims,assertAuthorizedMcpClaims} from '../lib/killa-mcp-auth.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const token=claims=>'a.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';
const identity={sub:'d9b4c5a6-1111-4444-8888-aaaaaaaaaaaa',client_id:'oc_chatgpt',aal:'aal2'};
test('MCP refuses ordinary Supabase user token, tokens for another user and unknown client',()=>{
 assert.equal(jwtClaims(token(identity)).client_id,'oc_chatgpt');
 assert.throws(()=>assertAuthorizedMcpClaims(jwtClaims(token({...identity,client_id:undefined})),
  {userId:identity.sub,allowedClientIds:['oc_chatgpt']}),/oauth|cliente|client/i);
 assert.throws(()=>assertAuthorizedMcpClaims(jwtClaims(token(identity)),
  {userId:'aaaaaaaa-2222-4444-9999-bbbbbbbbbbbb',allowedClientIds:['oc_chatgpt']}),/usu[aá]rio|identidade/i);
 assert.throws(()=>assertAuthorizedMcpClaims(jwtClaims(token(identity)),
  {userId:identity.sub,allowedClientIds:['oc_claude']}),/autorizad|cliente/i);
});
test('MCP accepts OAuth AAL1 only when a recent MFA proof was verified server-side',()=>{
 assert.throws(()=>assertAuthorizedMcpClaims(jwtClaims(token({...identity,aal:'aal1'})),
  {userId:identity.sub,allowedClientIds:['oc_chatgpt'],mfaGrantVerified:false}),/MFA|segundo fator|confirm/i);
 assert.equal(assertAuthorizedMcpClaims(jwtClaims(token({...identity,aal:'aal1'})),
  {userId:identity.sub,allowedClientIds:['oc_chatgpt'],mfaGrantVerified:true}).clientId,'oc_chatgpt');
});
test('All MCP methods require OAuth; ordinary CRM routes refuse OAuth tokens',()=>{
 const office=read('lib/office-server.mjs'),route=read('app/mcp/route.js');
 assert.match(office,/allowOAuth/);
 assert.match(office,/oauth.*not.*allowed|oauth_token_not_allowed/i);
 assert.match(route,/officeAuth\(request,\{allowOAuth:true\}\)/);
 assert.doesNotMatch(route,/method==='tools\/call'.*officeAuth/s);
});
test('The MCP does not disclose pairing QR, pairing token or login secrets',()=>{
 const mcp=read('lib/killa-mcp.mjs');
 assert.match(mcp,/killa_whatsapp_status/);
 assert.match(mcp,/pairingUrl/);
 assert.doesNotMatch(mcp,/qr:\s*result\.connection\.qr/);
 const page=read('app/mcp/pair/page.jsx');
 assert.match(page,/WaAutoInbox|qrImage|connection\.qr/);
 assert.match(page,/SecuredWorkspace|useWorkspaceSession/);
});
test('Killa API and database maintain an owner-scoped, verified attendance KPI',()=>{
 const route=read('app/api/office/agent/kpis/route.js');
 assert.match(route,/officeAuth/);
 assert.match(route,/accepted/);
 assert.match(route,/owner_id/);
 assert.match(route,/OpenBot|Killa/);
 const rep=read('app/report/page.jsx');
 assert.match(rep,/OpenBot|Killa AI/);
});
test('The security policy protects keys and explicitly rejects claims of invulnerable browser code',()=>{
 const doc=read('SECURITY.md');
 assert.match(doc,/publishable/i);
 assert.match(doc,/service_role|sb_secret_/i);
 assert.match(doc,/engenharia reversa/i);
 assert.match(doc,/LGPD/i);
 const lex=read('docs/SEGURANCA-MCP-LGPD.md');
 assert.match(lex,/OAuth/);
 assert.match(lex,/RLS/);
});
