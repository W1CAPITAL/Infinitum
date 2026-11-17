import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('preinstaller runs after CRM loads, only on fixed production origin, without starting Qwen inference',()=>{
 const layout=read('app/layout.jsx'),bootstrap=read('components/qwen-preinstall-bootstrap.jsx');
 assert.match(layout,/QwenPreinstallBootstrap/);
 assert.match(bootstrap,/QWEN_PREINSTALL_ORIGIN/);
 assert.match(bootstrap,/setTimeout\(start,3500\)/);
 assert.match(bootstrap,/chooseQwenDownloadConcurrency/);
 assert.match(bootstrap,/\/workers\/qwen-installer\.worker\.mjs/);
 assert.doesNotMatch(bootstrap,/runBlackholeQwen\(/);
 assert.doesNotMatch(bootstrap,/pipeline\(/);
});
test('Qwen background installer uses verified single-range requests with no whole-file fallback',()=>{
 const installer=read('public/workers/qwen-installer.worker.mjs');
 assert.match(installer,/headers:\{Range:'bytes='\+start\+'-'\+end\}/);
 assert.match(installer,/resp\.status!==206/);
 assert.match(installer,/resp\.body\?\.cancel\(\)/);
 assert.match(installer,/writeChunk:saveQwenChunk/);
 assert.match(installer,/await downloadQwenChunks\(/);
 assert.match(installer,/getQwenManifest/);
 assert.doesNotMatch(installer,/pipeline\(|runBlackholeQwen\(/);
});
test('pipeline consumes streamed q8 ONNX segments instead of downloading a parallel 512MB file',()=>{
 const runtime=read('public/workers/blackhole-qwen-0.5b.worker.mjs');
 assert.match(runtime,/getQwenModelResponse/);
 assert.match(runtime,/getQwenPreinstallStatus/);
 assert.match(runtime,/lib\.env\.useCustomCache=true/);
 assert.match(runtime,/lib\.env\.customCache=/);
 assert.match(runtime,/if\(!previous&&!state\.complete\)/);
 assert.match(runtime,/em segundo plano/);
});
test('cached weights survive logout, and preparation stores no personal client data',()=>{
 const installer=read('public/workers/qwen-installer.worker.mjs');
 const store=read('public/workers/qwen-preinstall-store.mjs');
 assert.doesNotMatch(installer,/supabase|processos|office_agent_runs|localStorage\.clear/i);
 assert.doesNotMatch(store,/supabase|tenant_id|auth\.uid|service_role/i);
 assert.match(store,/indexedDB\.open\(QWEN_PREINSTALL_DB/);
});

test('when CDN rejects byte ranges, full-file fallback caches to disk off-main-thread rather than disabling Qwen forever',()=>{
 const installer=read('public/workers/qwen-installer.worker.mjs');
 assert.match(installer,/cacheWholeModel/);
 assert.match(installer,/await cache\.put\(MODEL_URL,response\)/);
 assert.match(installer,/nativeCached/);
 assert.match(installer,/O fornecedor não disponibilizou retomada por partes/);
});
