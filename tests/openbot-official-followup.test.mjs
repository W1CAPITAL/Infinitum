import test from 'node:test';import assert from 'node:assert/strict';
import {assessOpenBotPostReturnResearch} from '../lib/openbot-official-followup.mjs';
const base={
 caseRow:{ultimo_retorno:'2026-10-15',datajud_ultimo_movimento:'2026-03-01',
  datajud_last_ok:true,datajud_ultimo_nome:'Conclusos para despacho'},
 now:new Date('2026-11-16T16:00:00Z')
};
const snapshot=(source,items=[])=>({source,checked_at:'2026-11-16T15:00:00Z',
 payload:{source:source==='djen'?'DJEN':'DataJud',checkedAt:'2026-11-16T15:00:00Z',items}});
test('stagnant process requires fresh checks from both DJEN and DataJud after last return',()=>{
 assert.equal(assessOpenBotPostReturnResearch({...base,snapshots:[]}).ok,false);
 assert.equal(assessOpenBotPostReturnResearch({...base,snapshots:[snapshot('datajud')]}).ok,false);
 const both=assessOpenBotPostReturnResearch({...base,snapshots:[snapshot('datajud'),snapshot('djen')]});
 assert.equal(both.ok,true);assert.equal(both.checkedAt,'2026-11-16T15:00:00.000Z');
});
test('stale, partial and failed judicial check never proves that nothing happened',()=>{
 const stale=snapshot('djen');stale.checked_at='2026-09-01T00:00:00Z';
 assert.equal(assessOpenBotPostReturnResearch({...base,snapshots:[snapshot('datajud'),stale]}).ok,false);
 const failed=snapshot('djen');failed.payload.stale=true;
 assert.equal(assessOpenBotPostReturnResearch({...base,snapshots:[snapshot('datajud'),failed]}).ok,false);
});
test('newer official events must go to professional review; do not repeat old information',()=>{
 const datajud=snapshot('datajud',[{dataHora:'2026-11-10T14:00:00Z',nome:'Petição juntada'}]);
 const r=assessOpenBotPostReturnResearch({...base,snapshots:[datajud,snapshot('djen')]});
 assert.equal(r.ok,false);assert.equal(r.reason,'new_official_activity_requires_review');
});
test('unknown event dates cannot be safely called absence of movement',()=>{
 const r=assessOpenBotPostReturnResearch({...base,snapshots:[snapshot('datajud',[{nome:'Não identificado'}]),snapshot('djen')]});
 assert.equal(r.ok,false);
});
test('recent movement since last contact does not require extra forced DJEN query to draft a verified event',()=>{
 const caseRow={...base.caseRow,datajud_ultimo_movimento:'2026-11-10'};
 assert.equal(assessOpenBotPostReturnResearch({...base,caseRow,snapshots:[]}).ok,true);
});
