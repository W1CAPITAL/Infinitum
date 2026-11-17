import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeOpenBotPolicy} from '../lib/openbot-company-agent.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('shared Lexis policy preserves only unique, valid public OAuth client IDs',()=>{
 const policy=normalizeOpenBotPolicy({
  mcp_enabled:true,
  mcp_allowed_client_ids:['opencode-client-123','bad id','opencode-client-123','x']
 });
 assert.equal(policy.mcp_enabled,true);
 assert.deepEqual(policy.mcp_allowed_client_ids,['opencode-client-123']);
});

test('shared Lexis MCP setup uses company policy API and the Vercel MCP endpoint',()=>{
 const page=read('app/mcp/setup/page.jsx');
 assert.match(page,/NEXT_PUBLIC_LEXIS_SHARED_DB/);
 assert.match(page,/\/api\/office\/agent\/company/);
 assert.match(page,/https:\/\/agentinfinitum\.vercel\.app\/mcp/);
 assert.match(page,/mcp_allowed_client_ids/);
 assert.match(page,/registro dinâmico e pode gerar um novo ID OAuth a cada novo login/);
 assert.match(page,/Para manter um ID fixo/);
});

test('shared Lexis OAuth consent reads the same company allowlist instead of the native-only table',()=>{
 const page=read('app/oauth/consent/page.jsx');
 assert.match(page,/NEXT_PUBLIC_LEXIS_SHARED_DB/);
 assert.match(page,/office_agent_company_policies/);
 assert.match(page,/mcp_allowed_client_ids/);
});
