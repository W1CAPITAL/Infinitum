import test from 'node:test';
import assert from 'node:assert/strict';
import {planColibriLocal,COLIBRI_LOCAL_POLICY} from '../lib/colibri-local.mjs';

test('Colibri Local routes entirely offline without a separate model unless requested',()=>{
 const x=planColibriLocal({prompt:'Qual a última movimentação do meu processo?',allowLocalModel:false,device:{webgpu:true,memoryGb:16}});
 assert.equal(x.engine,'rules');
 assert.equal(x.offline,true);
 assert.equal(x.needsServer,false);
 assert.equal(x.autoSend,false);
});
test('Colibri Local uses quantized Qwen over CPU when WebGPU is absent',()=>{
 const base={prompt:'Reescreva esta informação em linguagem simples',allowLocalModel:true,device:{webgpu:true,memoryGb:8}};
 assert.equal(planColibriLocal(base).engine,'qwen');
 assert.equal(planColibriLocal({...base,allowLocalModel:false}).engine,'rules');
 assert.equal(planColibriLocal({...base,device:{webgpu:false,memoryGb:8}}).engine,'qwen');
 assert.equal(planColibriLocal({...base,device:{webgpu:true,memoryGb:4}}).engine,'qwen');
 assert.equal(planColibriLocal({...base,device:{webgpu:true,memoryGb:0}}).engine,'qwen');
});
test('Colibri Local never treats disk cache as GPU/RAM replacement',()=>{
 assert.equal(COLIBRI_LOCAL_POLICY.maxNewTokens>=2048,true);
 assert.equal(COLIBRI_LOCAL_POLICY.requiresWebGpu,false);
 assert.equal(COLIBRI_LOCAL_POLICY.free,true);
 assert.equal(COLIBRI_LOCAL_POLICY.cacheRole,'weights_only');
});
