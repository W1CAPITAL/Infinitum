import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MODEL_CACHE_KEY,inspectQwenModelCache,requestPersistentQwenCache} from '../lib/qwen-persistent-cache.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('reuse Transformers.js existing cache namespace instead of forcing a new 786MB download',()=>{
 assert.equal(MODEL_CACHE_KEY,'transformers-cache');
 const worker=read('public/workers/blackhole-qwen-0.5b.worker.mjs');
 assert.match(worker,/env\.useBrowserCache\s*=\s*true/);
 assert.match(worker,/env\.useWasmCache\s*=\s*true/);
 assert.match(worker,/env\.cacheKey\s*=\s*['"]transformers-cache['"]/);
 assert.doesNotMatch(worker,/fetch\('https:\/\/huggingface\.co\/onnx-community.*config\.json/);
});
test('cache inspection never confuses partially downloaded weights with a complete model',async()=>{
 const storage={persisted:async()=>true,estimate:async()=>({usage:500,quota:8000000000})};
 const caches={has:async()=>true,open:async()=>({keys:async()=>[
  {url:'https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/config.json'}
 ]})};
 const c=await inspectQwenModelCache({storage,cacheStorage:caches});
 assert.equal(c.persisted,true);assert.equal(c.cachedFiles,1);
 assert.equal(c.complete,false);
 assert.equal(c.cacheKey,'transformers-cache');
});
test('persistent storage permission is requested once with graceful fallback',async()=>{
 let calls=0;const storage={persisted:async()=>false,persist:async()=>{calls++;return false},estimate:async()=>({usage:0,quota:900000000})};
 const c=await requestPersistentQwenCache({storage});
 assert.equal(c.persisted,false);assert.equal(c.supported,true);
 assert.equal(calls,1);
 const fallback=await requestPersistentQwenCache({storage:null});
 assert.equal(fallback.supported,false);
});
test('model stays warm for follow-up questions and releases RAM after idle',()=>{
 const runtime=read('lib/blackhole-local-llm.mjs');
 assert.match(runtime,/IDLE_RELEASE_MS/);
 assert.match(runtime,/scheduleIdleRelease\(\)/);
 assert.match(runtime,/requestPersistentQwenCache/);
 assert.match(runtime,/getQwenCacheStatus/);
 const workbench=read('components/openbot-workbench.jsx');
 const legal=read('components/office-legal-agent-panel.jsx');
 assert.doesNotMatch(workbench,/finally\s*\{stopBlackholeQwen\(\)\}/);
 assert.doesNotMatch(legal,/finally\s*\{stopBlackholeQwen\(\)\}/);
});
test('CPU cannot saturate all cores and model weights do not reload while worker stays initialized',()=>{
 const worker=read('public/workers/blackhole-qwen-0.5b.worker.mjs');
 assert.match(worker,/numThreads\s*=\s*1/);
 assert.match(worker,/if\(generator&&deviceUsed===device&&loadedModel===modelId\)return generator/);
 // Do not reuse a warm model after switching between Qwen variants.
 assert.match(worker,/loadedModel!==modelId/);
 assert.match(worker,/useBrowserCache/);
 assert.doesNotMatch(worker,/\benv\.useBrowserCache\s*=\s*false/);
});
