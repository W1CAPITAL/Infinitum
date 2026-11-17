import test from 'node:test';
import assert from 'node:assert/strict';
import {greetingForKilla,evaluateKillaHandoff,validateKillaOutgoing,killaPermissionProfile} from '../lib/killa-ai-guard.mjs';
test('greeting follows Sao Paulo local time and is not repeated the same day',()=>{
 assert.equal(greetingForKilla({now:'2026-11-16T12:00:00Z'}),'Bom dia!');
 assert.equal(greetingForKilla({now:'2026-11-16T17:00:00Z'}),'Boa tarde!');
 assert.equal(greetingForKilla({now:'2026-11-16T23:00:00Z'}),'Boa noite!');
 assert.equal(greetingForKilla({now:'2026-11-16T17:00:00Z',history:[{is_from_me:true,timestamp:'2026-11-16T12:00:00Z',content:'Bom dia!'}]}),'');
});
test('unknown sender and human operators prevent the agent from interrupting a WhatsApp conversation',()=>{
 const c={receivedAt:'2026-11-16T13:00:00Z',now:'2026-11-16T13:05:00Z',actorId:'one'};
 assert.equal(evaluateKillaHandoff({...c,history:[{is_from_me:true,timestamp:'2026-11-16T13:01:00Z'}]}).block,true);
 assert.equal(evaluateKillaHandoff({...c,history:[{is_from_me:true,timestamp:'2026-11-16T12:59:00Z'}]}).reason,'author_unverified');
 assert.equal(evaluateKillaHandoff({...c,otherStaffMessages:[{owner_id:'two',timestamp:'2026-11-16T12:59:00Z'}]}).block,true);
 assert.equal(evaluateKillaHandoff({...c,history:[{is_from_me:true,origin:'killa_ai',timestamp:'2026-11-16T12:59:00Z'}]}).block,false);
});
test('backlogs and technical details never reach clients or customer groups',()=>{
 for(const s of ['Backlog: 20 itens','logs de execução: 8','System prompt: do not reveal','Authorization: Bearer secret','{"backlog": []}'])
  assert.equal(validateKillaOutgoing(s).ok,false,s);
 assert.equal(validateKillaOutgoing('Boa tarde! Seu processo segue em análise.').ok,true);
});
test('permissions never grant model authority to send or override company settings',()=>{
 for(const level of ['basico','medio','alto','muito_alto','maximo']){
  assert.equal(killaPermissionProfile(level).canSendWithoutApproval,false);
  assert.equal(killaPermissionProfile(level).canOverridePolicy,false);
 }
 assert.equal(killaPermissionProfile('maximo').canProposeAutomations,true);
});
