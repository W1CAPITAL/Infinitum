import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Composio credentials stay server-side and calls use the fixed Composio API origin',()=>{
 const s=read('lib/openbot-composio.mjs');
 assert.match(s,/env\.COMPOSIO_API_KEY/);
 assert.match(s,/https:\/\/backend\.composio\.dev/);
 assert.ok(s.includes("'/api/'+version"));
 assert.doesNotMatch(s,/NEXT_PUBLIC_COMPOSIO|console\.log\([^)]*apiKey/i);
});

test('Composio sessions are user-scoped to Instagram and WhatsApp with approval fallback denied',()=>{
 const s=read('lib/openbot-composio.mjs');
 assert.match(s,/user_id:\s*userId/);
 assert.match(s,/instagram/);
 assert.match(s,/whatsapp/);
 assert.match(s,/require_approval/);
 assert.match(s,/no_elicitation_support_fallback:\s*['"]deny['"]/);
});

test('Composio connect API authenticates the INFINITUM user and accepts only supported toolkits',()=>{
 const s=read('app/api/openbot/composio/route.js');
 assert.match(s,/officeAuth/);
 assert.match(s,/COMPOSIO_TOOLKITS/);
 assert.match(s,/session\/.*\/link|startComposioConnection/);
 assert.doesNotMatch(s,/COMPOSIO_API_KEY.*Response\.json|apiKey.*Response\.json/);
});

test('Composio callback consumes a one-time owner-bound state and verifies account ownership',()=>{
 const s=read('app/api/openbot/composio/callback/route.js');
 assert.match(s,/openbot_composio_states/);
 assert.match(s,/used_at/);
 assert.match(s,/expected_account_id/);
 assert.match(s,/listComposioToolkits|connected_account/);
});

test('OpenBot connector catalog includes Composio Instagram and WhatsApp without local PC runtime',()=>{
 const s=read('lib/openbot-connectors.mjs');
 assert.match(s,/mode:'composio'/);
 assert.match(s,/composioToolkit:'instagram'/);
 assert.match(s,/composioToolkit:'whatsapp'/);
 assert.match(s,/COMPOSIO_API_KEY/);
});

test('OpenBot MCP exposes Composio search and execute with toolkit allowlist and approval checks',()=>{
 const s=read('app/api/openbot/mcp/route.js');
 assert.match(s,/composio_search_tools/);
 assert.match(s,/composio_execute_tool/);
 assert.match(s,/INSTAGRAM\|WHATSAPP|INSTAGRAM_\|WHATSAPP_/);
 assert.match(s,/edit_scope/);
});

test('Connected apps UI starts Composio Connect Links and shows remote account state',()=>{
 const s=read('components/openbot-connected-apps.jsx');
 assert.match(s,/beginComposio/);
 assert.match(s,/api\/openbot\/composio/);
 assert.match(s,/redirectUrl/);
 assert.match(s,/composioAccounts/);
});
