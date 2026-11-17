import test from 'node:test';
import assert from 'node:assert/strict';
import {planColibriLocal,COLIBRI_LOCAL_POLICY} from '../lib/colibri-local.mjs';
import {selectLocalQwenBackend,normalizeLocalTokenBudget} from '../lib/local-qwen-runtime.mjs';

test('without WebGPU the free Qwen 0.5B selects CPU/WASM instead of refusing',()=>{
 const plan=planColibriLocal({prompt:'Escreva uma peça',allowLocalModel:true,device:{webgpu:false,memoryGb:4}});
 assert.equal(plan.engine,'qwen');
 assert.equal(plan.device,'wasm');
 assert.equal(plan.needsServer,false);
 assert.equal(plan.autoSend,false);
});
test('missing navigator.deviceMemory is not mistaken for zero RAM',()=>{
 assert.equal(selectLocalQwenBackend({webgpu:false,memoryGb:0}).ok,true);
 assert.equal(selectLocalQwenBackend({webgpu:false,memoryGb:0}).device,'wasm');
 assert.equal(selectLocalQwenBackend({webgpu:true,memoryGb:0}).device,'wasm');
 assert.equal(selectLocalQwenBackend({webgpu:true,memoryGb:8,preferCpu:false}).device,'webgpu');
});
test('low memory warns rather than silently freezing CPU with massive model',()=>{
 const result=selectLocalQwenBackend({webgpu:false,memoryGb:2});
 assert.equal(result.ok,false);
 assert.match(result.reason,/memória|RAM/i);
});
test('user controls response length, no arbitrary 48 or 96 token limit',()=>{
 assert.equal(normalizeLocalTokenBudget(300),300);
 assert.equal(normalizeLocalTokenBudget(2048),2048);
 assert.equal(COLIBRI_LOCAL_POLICY.maxNewTokens,2048);
 assert.equal(COLIBRI_LOCAL_POLICY.free,true);
});
test('still refuses to download a neural model without consent',()=>{
 assert.equal(planColibriLocal({allowLocalModel:false,device:{webgpu:false,memoryGb:4}}).engine,'rules');
});
