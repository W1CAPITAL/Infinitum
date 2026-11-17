import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {jwtClaims,assertAuthorizedMcpClaims} from '../lib/killa-mcp-auth.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const token=claims=>'a.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';
const identity={sub:'d9b4c5a6-1111-4444-8888-aaaaaaaaaaaa',client_id:'oc_chatgpt',aal:'aal1'};
test('MCP refuses ordinary Supabase user token, tokens for another user and unknown client',()=>{
 assert.equal(jwtClaims(token(identity)).client_id,'oc_chatgpt');
 assert.throws(()=>assertAuthorizedMcpClaims(jwtClaims(token({...identity,client_id:undefined})),
  {userId:identity.sub,allowedClientIds:['oc_chatgpt'],mfaGrantVerified:true}),/oauth|cliente|client/i);
 assert.throws(()=>assertAuthorizedMcpClaims(jwtClaims(token(identity)),
  {userId:'aaaaaaaa-2222-4444-9999-bbbbbbbbbbbb',allowedClientIds:['oc_chatgpt'],mfaGrantVerified:true}),/usu[aá]rio|identidade/i);
 assert.throws(()=>assertAuthorizedMcpClaims(jwtClaims(token(identity)),
  {userId:identity.sub,allowedClientIds:['oc_claude'],mfaGrantVerified:true}),/autorizad|cliente/i);
});
test('MCP accepts Supabase OAuth AAL1 only with a recent server-verified MFA grant',()=>{
 assert.throws(()=>assertAuthorizedMcpClaims(jwtClaims(token(identity)),
  {userId:identity.sub,allowedClientIds:['oc_chatgpt'],mfaGrantVerified:false}),/MFA|segundo fator|confirm/i);
 assert.equal(assertAuthorizedMcpClaims(jwtClaims(token(identity)),
  {userId:identity.sub,allowedClientIds:['oc_chatgpt'],mfaGrantVerified:true}).clientId,'oc_chatgpt');
});
test('company MCP authorization verifies the private MFA grant for the exact user and OAuth client',()=>{
 const m=read('lib/killa-mcp.mjs');
 assert.match(m,/killa_check_mcp_mfa_grant/);
 assert.match(m,/p_client_id:\s*identity\.clientId/);
 assert.match(m,/mfaGrantVerified/);
});
test('consent stores the AAL2 proof before approving or auto-redirecting OAuth',()=>{
 const c=read('app/oauth/consent/page.jsx');
 assert.match(c,/killa_record_mcp_mfa_grant/);
 assert.match(c,/authorizationId/);
 assert.match(c,/currentLevel==='aal2'/);
 assert.match(c,/approveAuthorization/);
 assert.match(c,/redirect_url/);
});
test('MCP preserves 401 only for authentication failures and returns 403/503 for authorization or infrastructure failures',()=>{
 const r=read('app/mcp/route.js');
 assert.match(r,/error\?\.status/);
 assert.match(r,/status===401/);
 assert.match(r,/\[403,429,503\]/);
 assert.doesNotMatch(r,/catch\{return killaMcpUnauthorized\(\)\}/);
});
test('MFA grant storage is private, short-lived, company-scoped and writable only through guarded RPC',()=>{
 const s=read('supabase/migrations/20261116205000_killa_mcp_oauth_mfa_grants.sql');
 assert.match(s,/killa_mcp_oauth_mfa_grants/);
 assert.match(s,/ENABLE ROW LEVEL SECURITY/);
 assert.match(s,/REVOKE ALL.*authenticated/s);
 assert.match(s,/auth\.jwt\(\)->>'aal'.*aal2/s);
 assert.match(s,/mcp_allowed_client_ids/);
 assert.match(s,/interval '8 hours'/i);
 assert.match(s,/killa_record_mcp_mfa_grant/);
 assert.match(s,/killa_check_mcp_mfa_grant/);
});
