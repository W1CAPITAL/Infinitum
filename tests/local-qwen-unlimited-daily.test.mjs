import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCAL_QWEN_RUNTIME,normalizeLocalTokenBudget} from '../lib/local-qwen-runtime.mjs';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('local Qwen use has no daily token or request quota',()=>{
 assert.equal(LOCAL_QWEN_RUNTIME.dailyTokenLimit,null);
 assert.equal(LOCAL_QWEN_RUNTIME.dailyRequestLimit,null);
 assert.equal(LOCAL_QWEN_RUNTIME.externalInference,false);
 assert.equal(normalizeLocalTokenBudget(1536),1536);
 assert.equal(normalizeLocalTokenBudget(5000),2048);
});
test('AI daily usage is unlimited and response length is a per-generation hardware control',()=>{
 const ui=read('components/openbot-workbench.jsx');
 assert.match(ui,/Sem cota di[aá]ria de tokens ou perguntas/);
 assert.match(ui,/\[128,256,384,512,768,1024,1536,2048\]/);
 assert.match(read('public/workers/blackhole-qwen-0.5b.worker.mjs'),/Math\.min\(2048,/);
});
test('unlimited AI usage does not remove legal WhatsApp anti-spam controls',()=>{
 assert.match(read('app/api/office/agent/reply/route.js'),/reserve_office_agent_reply/);
 assert.match(read('lib/office-legal-reply.mjs'),/daily_volume_limit/);
});
