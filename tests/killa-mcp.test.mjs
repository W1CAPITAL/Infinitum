import test from 'node:test';
import assert from 'node:assert/strict';
import {KILLA_MCP_TOOLS,handleKillaMcpMessage,MCP_VERSION} from '../lib/killa-mcp.mjs';
import {killaResourceMetadata,killaMcpUnauthorized} from '../lib/killa-mcp-oauth.mjs';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('MCP handshake and listing expose only read-only tools without secrets or customer content',async()=>{
 const init=await handleKillaMcpMessage({jsonrpc:'2.0',id:1,method:'initialize',params:{}});
 assert.equal(init.result.protocolVersion,MCP_VERSION);
 const list=await handleKillaMcpMessage({jsonrpc:'2.0',id:2,method:'tools/list'});
 assert.equal(list.result.tools.length,6);
 assert.ok(list.result.tools.every(t=>t.annotations.readOnlyHint===true&&!/send_reply|send_whatsapp/.test(t.name)));
 assert.ok(KILLA_MCP_TOOLS.some(t=>t.name==='killa_preview_reply'));
});
test('MCP declines batch and authenticates every data tool call',()=>{
 const r=read('app/mcp/route.js');
 assert.match(r,/officeAuth\(request,\{allowOAuth:true\}\)/);
 assert.match(r,/killaMcpUnauthorized/);
 assert.match(r,/Array\.isArray\(message\)/);
 assert.doesNotMatch(r,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
test('MCP OAuth discovery is a protected resource, never a public dataset',()=>{
 const m=killaResourceMetadata('https://example.supabase.co');
 assert.equal(m.authorization_servers[0],'https://example.supabase.co/auth/v1');
 assert.equal(m.resource,'https://agentinfinitum.vercel.app/mcp');
 assert.equal(killaResourceMetadata('http://127.0.0.1:54321'),null);
 const response=killaMcpUnauthorized();
 assert.equal(response.status,401);
 assert.match(response.headers.get('WWW-Authenticate'),/resource_metadata=/);
});
test('MCP tools are scoped by both authenticated operator and company, with deny-by-default',()=>{
 const m=read('lib/killa-mcp.mjs');
 assert.match(m,/mcp_enabled!==true/);
 assert.match(m,/\.eq\('owner_id',user.id\)/);
 assert.match(m,/\.eq\('empresa_id',company\)/);
 assert.match(m,/policy\.mcp_group_history_enabled/);
 assert.doesNotMatch(m,/waAutoOperation\('send'/);
});
test('consent UI requires real Supabase login and per-client authorization',()=>{
 const c=read('app/oauth/consent/page.jsx');
 assert.match(c,/getAuthorizationDetails/);
 assert.match(c,/approveAuthorization/);
 assert.match(c,/denyAuthorization/);
 assert.match(c,/session\?\.user/);
});
