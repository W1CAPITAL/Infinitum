import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchCompanyRows} from '../lib/lexis-company-data.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('relatório executivo não perde processos acima de 3000 nem descarta array de atendimentos',async()=>{
 const records=Array.from({length:3501},(_,i)=>({id:i+1}));
 const query={select(){return query},eq(k,v){assert.equal(k,'empresa_id');assert.equal(v,'tenant');return query},order(){return query},range(a,b){return Promise.resolve({data:records.slice(a,b+1),error:null})}};
 const db={from(table){assert.equal(table,'processos');return query}};
 assert.equal((await fetchCompanyRows(db,'processos','id','tenant')).length,3501);
 const report=read('app/report/page.jsx');
 assert.match(report,/fetchCompanyRows\(db,'processos',col,empresaId/);
 assert.match(report,/adaptLexisToExecutiveReport\(\{processes,activities:acts,members:/);
 assert.doesNotMatch(report,/acts\.data|range\(2000,2999\)/);
 const office=read('components/lexis-shared-office.jsx');
 assert.match(office,/setAttendance\(r\)/);
 assert.doesNotMatch(office,/setAttendance\(r\.data/);
});

test('tarefas e vencidos acumulam registros automaticamente sem substituir a página anterior',()=>{
 const operations=read('components/lexis-operations.jsx');
 assert.match(operations,/listing\.slice\(0,\(page\+1\)\*PAGE_SIZE\)/);
 assert.match(operations,/<ProgressiveListEnd/);
 const sentinel=read('components/progressive-list-end.jsx');
 assert.match(sentinel,/IntersectionObserver/);
 assert.match(sentinel,/disconnect\(\)/);
});
