import test from 'node:test';
import assert from 'node:assert/strict';
import {remoteRelayRequest,RELAY_ORIGIN} from '../lib/opencode-relay-policy.mjs';
const id='d023bcb2-780d-4b3b-ae3e-d861bba4c30a';
test('ponte usa apenas URL fixa, com operações necessárias para os agentes',()=>{
 assert.equal(RELAY_ORIGIN,'https://predictbot-opencode.daviconcentrix.workers.dev');
 assert.deepEqual(remoteRelayRequest({action:'devices'}),{method:'GET',path:'/v1/devices',body:null});
 assert.deepEqual(remoteRelayRequest({action:'task',jobId:id}),{method:'POST',path:'/v1/task',body:{jobId:id}});
 assert.equal(remoteRelayRequest({action:'submit',deviceId:id,operation:'create',key:id,input:{title:'Revisão manual'}}).body.operation,'create');
 assert.equal(remoteRelayRequest({action:'submit',deviceId:id,operation:'prompt',key:id,input:{sessionId:'ses123',text:'Teste'}}).body.operation,'prompt');
});
test('nega URL arbitrária, edições remotas, tokens e entradas excessivas',()=>{
 for(const input of [{action:'delete'},{action:'devices',url:'https://evil.example'},{action:'submit',deviceId:id,operation:'abort',key:id,input:{sessionId:'ses123'}},{action:'submit',deviceId:id,operation:'prompt',key:id,input:{sessionId:'ses123',text:'a'.repeat(33000)}},{action:'task',jobId:'../outside'}])
  assert.throws(()=>remoteRelayRequest(input));
});
