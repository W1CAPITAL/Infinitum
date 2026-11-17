import test from 'node:test';
import assert from 'node:assert/strict';
import {QWEN_CHUNK_BYTES,buildQwenChunkPlan,canPrefetchQwen,modelPreinstallUrl} from '../lib/qwen-preinstall-policy.mjs';

test('full 512MB model can resume after reload by downloading only missing 8MB chunks',()=>{
 const expected=512*1024*1024;
 const plan=buildQwenChunkPlan(expected,new Set([0,1,4]),QWEN_CHUNK_BYTES);
 assert.equal(plan.length,64-3);
 assert.equal(plan[0].index,2);
 assert.equal(plan[0].start,2*QWEN_CHUNK_BYTES);
 assert.equal(plan[0].end,3*QWEN_CHUNK_BYTES-1);
 assert.equal(plan[1].index,3);
 assert.equal(plan[2].index,5);
});
test('resumption handles partial final chunk and refuses unknown or huge model sizes',()=>{
 const plan=buildQwenChunkPlan(2*QWEN_CHUNK_BYTES+5,new Set([0,1]));
 assert.deepEqual(plan,[{index:2,start:2*QWEN_CHUNK_BYTES,end:2*QWEN_CHUNK_BYTES+4}]);
 assert.throws(()=>buildQwenChunkPlan(0,new Set()));
 assert.throws(()=>buildQwenChunkPlan(3*1024*1024*1024,new Set()));
});
test('background install only on a stable, suitable browser with spare storage',()=>{
 const base={visible:true,memoryGb:8,freeBytes:1200*1024*1024,
  saveData:false,effectiveType:'4g',sameStableOrigin:true};
 assert.equal(canPrefetchQwen(base).ok,true);
 assert.equal(canPrefetchQwen({...base,freeBytes:100*1024*1024}).ok,false);
 assert.equal(canPrefetchQwen({...base,visible:false}).ok,false);
 assert.equal(canPrefetchQwen({...base,saveData:true}).ok,false);
 assert.equal(canPrefetchQwen({...base,effectiveType:'2g'}).ok,false);
 assert.equal(canPrefetchQwen({...base,memoryGb:2}).ok,false);
 assert.equal(canPrefetchQwen({...base,sameStableOrigin:false}).ok,false);
});
test('preinstaller targets the EXACT Qwen q8 model ONNX file the CPU uses',()=>{
 assert.match(modelPreinstallUrl(),/onnx-community\/Qwen2\.5-0\.5B-Instruct\/resolve\/main\/onnx\/model_quantized\.onnx$/);
});
test('runtime uses streaming chunk cache and never unconditionally downloads the full model',async()=>{
 const {QWEN_PREINSTALL_DB,MODEL_CHUNK_STORE,createChunkedModelResponse}=await import('../public/workers/qwen-preinstall-store.mjs');
 assert.equal(QWEN_PREINSTALL_DB,'infinitum-qwen-preinstall-v1');
 assert.equal(MODEL_CHUNK_STORE,'chunks');
 let calls=0;
 const out=await createChunkedModelResponse({
  totalBytes:6,
  chunkCount:2,
  async getChunk(index){calls++;return index===0?new Uint8Array([1,2,3]):new Uint8Array([4,5,6])}
 });
 assert.equal(out.status,200);
 assert.deepEqual([...new Uint8Array(await out.arrayBuffer())],[1,2,3,4,5,6]);
 assert.equal(calls,2);
});
