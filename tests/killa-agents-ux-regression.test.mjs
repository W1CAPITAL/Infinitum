import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Killa generates a useful draft without waiting for a heavy Qwen download',()=>{
 const s=read('components/openbot-workbench.jsx');
 assert.match(s,/useState\('deterministico'\)/);
 assert.match(s,/setDraft\(authoritative(?:\.slice\(0,18000\))?\)/);
 assert.match(s,/setSource\(model\)/);
 assert.match(s,/Modelo local opcional/);
});
test('agents page starts with Killa workbench and moves the specialist catalog behind a disclosure',()=>{
 const s=read('components/office-console.jsx');
 const start=s.indexOf("{area==='agents'&&");
 const end=s.indexOf("{area==='reports'&&",start);
 const panel=s.slice(start,end);
 assert.ok(panel.indexOf('<OpenBotWorkbench')<panel.indexOf('OFFICE_AGENTS.filter'));
 assert.match(panel,/<details[^>]*>/);
 assert.match(s,/agents:\['runs'\]/);
 assert.match(s,/loadOfficeCollections\(db,\['clients','cases','deadlines','leads','messages'\]\)/);
});
test('MCP setup shows role, error, activation steps and keeps admin-only writes',()=>{
 const s=read('app/mcp/setup/page.jsx');
 assert.match(s,/role==='admin'/);
 assert.match(s,/killa_mcp_settings/);
 assert.match(s,/role="alert"/);
 assert.match(s,/OAuth/);
 assert.match(s,/MFA/);
 assert.match(s,/disabled=\{!canEdit\|\|saving\}/);
});

test('Killa offers generative writing only after explicit consent using existing authenticated Superagente API',()=>{
 const s=read('components/openbot-workbench.jsx');
 assert.match(s,/\[onlineConsent,setOnlineConsent\]=useState\(false\)/);
 assert.match(s,/if\(!onlineConsent\)throw Error/);
 assert.match(s,/auth\.getSession\(\)|db\.auth\.getSession\(\)/);
 assert.match(s,/fetch\('\/api\/superagente'/);
 assert.match(s,/externalAiConsent:true/);
 assert.match(s,/isGenerativeModel/);
 assert.match(s,/value="online"/);
});
