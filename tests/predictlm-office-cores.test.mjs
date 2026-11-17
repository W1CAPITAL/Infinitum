import test from 'node:test';
import assert from 'node:assert/strict';
import { planPredictLmLegalCores, classifyPredictLmFailure, predictLmCoreCatalog } from '../lib/predictlm-office-cores.mjs';

const now=new Date('2026-11-16T13:00:00Z');

test('PredictLM legal deterministic cores recognize simple official procedural event',()=>{
 const result=planPredictLmLegalCores({
  prompt:'Qual foi a última movimentação do meu processo?',
  movement:'Conclusos para decisão',source:'DataJud',officialConfirmed:true,
  checkedAt:'2026-11-16T12:30:00Z',now
 });
 assert.equal(result.route,'scanner-processual');
 assert.equal(result.verification,'verified');
 assert.equal(result.requiresHumanReview,false);
 assert.equal(result.sendsWhatsApp,false);
 assert.deepEqual(Object.keys(result.cores).sort(),['fly','human','macaque','mouse']);
 assert.ok(result.cores.human>=0&&result.cores.human<=100);
 assert.match(result.policy,/software/);
});
test('Urgent client issues stay with human office staff even if the DJEN is healthy',()=>{
 for(const prompt of ['Bloqueio da aposentadoria no processo','Houve penhora de meu salário','Ganhei a sentença?','Há prazo para recurso?','Meus honorários e pagamento']){
  const r=planPredictLmLegalCores({
    prompt,movement:'Conclusos para decisão',source:'DataJud',officialConfirmed:true,
    checkedAt:'2026-11-16T12:30:00Z',now
  });
  assert.equal(r.requiresHumanReview,true,prompt);
  assert.equal(r.sendsWhatsApp,false);
 }
});
test('Failure or old evidence never becomes confirmation of no judicial movement',()=>{
 for(const bad of [
  {officialConfirmed:false,checkedAt:'2026-11-16T12:30:00Z'},
  {officialConfirmed:true,checkedAt:'2026-10-01T10:00:00Z'},
  {officialConfirmed:true,checkedAt:'2026-11-17T12:30:00Z'}
 ]){
  const result=planPredictLmLegalCores({prompt:'Qual andamento?',movement:'Conclusos para decisão',source:'DataJud',now,...bad});
  assert.equal(result.requiresHumanReview,true);
  assert.equal(result.verification,'unverified');
 }
});
test('Recoverable upstream status is distinguished from authorization, invalid request and unsupported source',()=>{
 const cases={
  400:['invalid-input',false],
  401:['auth',false],
  403:['forbidden',false],
  404:['not-found',false],
  409:['conflict',false],
  423:['locked',true],
  429:['rate-limit',true],
  500:['upstream',true],
  501:['unsupported',false],
  502:['upstream',true],
  503:['upstream',true]
 };
 for(const [code,[kind,retry]] of Object.entries(cases)){
  const result=classifyPredictLmFailure(Number(code));
  assert.equal(result.kind,kind,code);
  assert.equal(result.retryable,retry,code);
  assert.ok(result.userMessage.length>5);
  assert.equal(result.automaticRetry,false);
 }
});
test('Only explicitly authorized narrow actions may reach the agent transport',()=>{
 const catalog=predictLmCoreCatalog();
 assert.ok(catalog.length>=5);
 assert.ok(catalog.every(c=>c.mode==='deterministic_read_only'));
 assert.ok(!catalog.some(c=>c.canSendWhatsapp||c.canCrossTenant));
});
