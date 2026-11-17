import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCAL_QWEN_MODELS,resolveLocalQwenModel,selectLocalQwenBackend} from '../lib/local-qwen-runtime.mjs';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('allowlisted Qwen3 models are local ONNX without inference API',()=>{
 assert.equal(resolveLocalQwenModel('qwen17'),'onnx-community/Qwen3-1.7B-ONNX');
 assert.equal(resolveLocalQwenModel('qwen4'),'onnx-community/Qwen3-4B-ONNX');
 assert.equal(Object.keys(LOCAL_QWEN_MODELS).length,3);
 assert.equal(selectLocalQwenBackend({modelId:'bad-host',memoryGb:8}).ok,false);
});
test('large model memory and GPU limits avoid freezing small PCs',()=>{
 assert.equal(selectLocalQwenBackend({modelId:resolveLocalQwenModel('qwen17'),memoryGb:4}).ok,false);
 assert.equal(selectLocalQwenBackend({modelId:resolveLocalQwenModel('qwen17'),memoryGb:8}).device,'wasm');
 assert.equal(selectLocalQwenBackend({modelId:resolveLocalQwenModel('qwen4'),memoryGb:8}).ok,false);
 assert.equal(selectLocalQwenBackend({modelId:resolveLocalQwenModel('qwen4'),memoryGb:8,preferCpu:false,webgpu:true}).device,'webgpu');
});
test('worker reuses CPU optimizations and supports tier switch',()=>{
 const source=read('public/workers/blackhole-qwen-0.5b.worker.mjs');
 assert.match(source,/AVAILABLE_MODELS/);
 assert.match(source,/modelId===MODEL/);
 assert.match(source,/numThreads=1/);
 assert.doesNotMatch(source,/COLIBRI_API_KEY|NEEDLE_API_KEY/);
 const ui=read('components/openbot-workbench.jsx');
 assert.match(ui,/Qwen3 1,7B/);
 assert.match(ui,/Qwen3 4B/);
});
