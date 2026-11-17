import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkBlackholeQwenSupport} from '../lib/blackhole-local-llm.mjs';
import {selectLocalQwenBackend} from '../lib/local-qwen-runtime.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('CPU/WebAssembly is the default backend even when WebGPU is available',()=>{
 const v=selectLocalQwenBackend({webgpu:true,memoryGb:8});
 assert.equal(v.device,'wasm');
 assert.equal(selectLocalQwenBackend({webgpu:false,memoryGb:4}).device,'wasm');
});
test('Killa starts with safe immediate draft while other AI screens retain existing explicit local settings',()=>{
 const workbench=read('components/openbot-workbench.jsx');
 const superagent=read('app/superagente/page.jsx');
 const legal=read('components/office-legal-agent-panel.jsx');
 assert.match(workbench,/\[engine,setEngine\]=useState\('deterministico'\)/);
 assert.match(workbench,/\[consent,setConsent\]=useState\(false\)/);
 assert.match(workbench,/setDraft\(authoritative\.slice\(0,18000\)\)/);
 assert.match(workbench,/\[preferCpu,setPreferCpu\]=useState\(true\)/);
 assert.match(superagent,/\[engine,setEngine\]=useState\('qwen'\)/);
 assert.match(superagent,/consent:true,preferCpu:true/);
 assert.match(legal,/\[consentQwen,setConsentQwen\]=useState\(true\)/);
});
test('no WebGPU consent interstitial blocks Qwen, no online provider called without opt-in',()=>{
 const superagent=read('app/superagente/page.jsx');
 const workbench=read('components/openbot-workbench.jsx');
 assert.doesNotMatch(superagent,/Verificando compatibilidade com WebGPU|Exige WebGPU|sem fallback CPU/);
 assert.doesNotMatch(superagent,/\(engine==='qwen'&&!qwenConsent/);
 assert.doesNotMatch(workbench,/\[preferCpu,setPreferCpu\]=useState\(false\)/);
 assert.match(superagent,/consent:true,preferCpu:true/);
 assert.match(workbench,/consent:true,maxTokens:tokenBudget/);
});
test('do not preload a multi-hundred-megabyte Qwen model at page render',()=>{
 const superagent=read('app/superagente/page.jsx');
 const workbench=read('components/openbot-workbench.jsx');
 assert.match(superagent,/async function ask\(/);
 assert.match(workbench,/async function generate\(/);
 assert.equal((superagent.match(/runBlackholeQwen\(/g)||[]).length,1);
 assert.equal((workbench.match(/runBlackholeQwen\(/g)||[]).length,1);
});
