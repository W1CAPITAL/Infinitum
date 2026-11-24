import test from 'node:test';
import assert from 'node:assert/strict';
import {consultHistoricalCase} from '../lib/judicial-history-client.mjs';
import {consultBothOfficialSources} from '../lib/combined-judicial-history.mjs';
import {readConsultationResponse} from '../lib/judicial-response-client.mjs';
const number='0005635-52.2024.8.17.3370';
test('gateway 504 without JSON is correctly classified and never represents an empty result',async()=>{
 const body=await readConsultationResponse(new Response('<html>Gateway timeout</html>',{status:504}));
 assert.equal(body.ok,false);assert.equal(body.status,504);assert.equal(body.code,'upstream_timeout');
 const result=await consultHistoricalCase({number,source:'datajud',fetchServer:async()=>body});
 assert.equal(result.sourceStatus.datajud,'timeout');assert.equal(result.ok,false);assert.equal(result.partial,true);
});
test('DJEN continues independently when DataJud exceeds its time budget',async()=>{
 const result=await consultHistoricalCase({number,source:'auto',independentSources:true,fetchServer:async({source})=>source==='datajud'?{ok:false,status:504,code:'upstream_timeout',error:'A fonte oficial excedeu o tempo disponível.'}:{ok:true,items:[{id:'dj1',source:'DJEN',date:'2026-11-24',title:'Publicação'}]}});
 assert.equal(result.sourceStatus.datajud,'timeout');assert.equal(result.sourceStatus.djen,'ok');assert.equal(result.items.length,1);assert.equal(result.partial,true);
});
test('combined backend classifies a numeric timeout even with nonstandard wording',async()=>{
 const result=await consultBothOfficialSources({djen:async()=>({ok:true,items:[]}),datajud:async()=>{throw Object.assign(Error('Tempo disponível excedido'),{status:504})}});
 assert.equal(result.sourceStatus.datajud,'timeout');assert.equal(result.partial,true);
});
test('authorization failure never retries a public endpoint',async()=>{
 const body=await readConsultationResponse(new Response('Forbidden',{status:403}));
 assert.equal(body.code,'crm_access');
 let called=false;
 await assert.rejects(()=>consultHistoricalCase({number,source:'djen',fetchServer:async()=>body,fetchBrowser:async()=>{called=true}}),/permissão/i);
 assert.equal(called,false);
});
