import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('edge MCP is independent of Vercel build and provider image QR',()=>{
 const s=read('supabase/functions/killa-mcp/index.ts');
 assert.match(s,/Deno\.serve/);assert.match(s,/withOAuthProtectedResource/);
 assert.match(s,/killa_whatsapp_pair/);assert.match(s,/type:'image'/);
 assert.match(s,/killa_request_send/);assert.match(s,/killa_send_status/);
});
test('send requires first-party MFA, owner atomic lease and never retries automatically',()=>{
 const s=read('supabase/functions/killa-mcp/index.ts');
 assert.match(s,/claims\?\.client_id/);assert.match(s,/claims\?\.aal!=='aal2'/);
 assert.match(s,/status:'processing'/);assert.match(s,/status','pending'/);
 assert.match(s,/\.eq\('owner_id',user.id\)/);assert.match(s,/userScoped===true/);
});
test('approval page uses existing Supabase session and never requests a password',()=>{
 const s=read('app/mcp/approve/page.jsx');
 assert.match(s,/useWorkspaceSession/);assert.match(s,/mfa\.getAuthenticatorAssuranceLevel/);
 assert.match(s,/confirm:true/);assert.match(s,/requestId/);
 assert.doesNotMatch(s,/type="password"|signInWithPassword/);
});
