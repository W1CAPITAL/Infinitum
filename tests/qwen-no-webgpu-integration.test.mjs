import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('no universal WebGPU restriction remains in client Qwen execution',()=>{
 const client=read('lib/blackhole-local-llm.mjs');
 const worker=read('public/workers/blackhole-qwen-0.5b.worker.mjs');
 assert.match(client,/selectLocalQwenBackend/);
 assert.match(worker,/device:'wasm'|create\('wasm'\)|device==='wasm'/);
 assert.match(worker,/numThreads=1/);
 assert.doesNotMatch(worker,/WebGPU indisponível\. Por segurança/);
});
test('agents can request more than 48 tokens without a paid PredictLM endpoint',()=>{
 const panel=read('components/office-legal-agent-panel.jsx');
 const workbench=read('components/openbot-workbench.jsx');
 assert.match(panel,/maxTokens:512/);
 assert.match(workbench,/tokenBudget/);
 assert.match(workbench,/createLegalDocumentHtml/);
 assert.match(workbench,/createLegalTimelineSvg/);
 assert.doesNotMatch(workbench,/maxTokens:48/);
});
test('does not increase WhatsApp mass messaging when increasing AI generation capacity',()=>{
 const code=read('lib/colibri-local.mjs');
 assert.match(code,/writesWhatsApp:false/);
 const route=read('app/api/office/agent/reply/route.js');
 assert.match(route,/reserve_office_agent_reply/);
});
