import test from 'node:test';
import assert from 'node:assert/strict';
import {planColibriLocal} from '../lib/colibri-local.mjs';
import {buildQwenReviewPrompt,assessQwenReview} from '../lib/qwen-review-guard.mjs';

test('Qwen is preferred for every task when explicitly allowed and WebGPU RAM is sufficient',()=>{
 for(const prompt of [
  'Qual a última movimentação do meu processo?',
  'Conforme a consulta oficial, conclusos para decisão',
  'Reescreva esta mensagem de forma simples',
  'O que devo informar sobre o andamento?'
 ]){
  const plan=planColibriLocal({prompt,allowLocalModel:true,device:{webgpu:true,memoryGb:8}});
  assert.equal(plan.engine,'qwen',prompt);
  assert.equal(plan.needsServer,false);
  assert.equal(plan.autoSend,false);
 }
});
test('Qwen requires consent and safe memory but can run without WebGPU',()=>{
 const input={prompt:'Qual andamento?',allowLocalModel:true,device:{webgpu:true,memoryGb:8}};
 assert.equal(planColibriLocal({...input,allowLocalModel:false}).engine,'rules');
 assert.equal(planColibriLocal({...input,device:{webgpu:false,memoryGb:16}}).engine,'qwen');
 assert.equal(planColibriLocal({...input,device:{webgpu:false,memoryGb:2}}).engine,'rules');
 assert.equal(planColibriLocal({...input,device:{webgpu:true,memoryGb:0}}).engine,'qwen');
 assert.equal(planColibriLocal({...input,device:{webgpu:true,memoryGb:4}}).engine,'qwen');
});
test('Qwen reviewer can polish a deterministic answer but cannot become a court source',()=>{
 const source='O processo 1234567-89.2026.8.26.0001 foi encaminhado ao juiz em 10/11/2026. Ainda não há decisão confirmada.';
 const prompt=buildQwenReviewPrompt(source);
 assert.match(prompt,/Não invente/);
 assert.match(prompt,/1234567-89.2026.8.26.0001/);
 const result=assessQwenReview(source,'O processo 1234567-89.2026.8.26.0001 foi encaminhado ao juiz em 10/11/2026. Ainda não há decisão confirmada.');
 assert.equal(result.ok,true);
 assert.equal(result.factualSource,'deterministic');
});
test('rejects invented payments, dates, CNJs, legal outcomes and removed disclaimers',()=>{
 const source='Não há pagamento confirmado. Processo 1234567-89.2026.8.26.0001 aguardando decisão em 10/11/2026.';
 const bad=[
 'O pagamento de R$ 10.000 foi autorizado. Processo 1234567-89.2026.8.26.0001 aguardando decisão em 10/11/2026.',
 'O processo 1234567-89.2026.8.26.0001 foi julgado procedente em 10/11/2026.',
 'Processo 1234567-89.2026.8.26.0001 aguardando decisão em 11/11/2026.',
 'Não há pagamento confirmado. Processo 2345678-89.2026.8.26.0001 aguardando decisão em 10/11/2026.',
 'O juiz deferiu o pagamento. Processo 1234567-89.2026.8.26.0001 aguardando decisão em 10/11/2026.'
 ];
 for(const answer of bad)assert.equal(assessQwenReview(source,answer).ok,false,answer);
});
test('never accepts LLM text as official verification or sends any WhatsApp',()=>{
 const source='Sem movimentação confirmada na última consulta. Não é possível garantir resultado.';
 const result=assessQwenReview(source,'Sem movimentação confirmada na última consulta. Não é possível garantir resultado.');
 assert.equal(result.triggersTransport,false);
 assert.equal(result.officiallyVerified,false);
 assert.equal(result.requiresHumanReview,true);
});
