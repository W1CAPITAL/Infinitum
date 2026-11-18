import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchLexisAttendanceRows} from '../lib/lexis-attendance-report-data.mjs';

const COMPANY='b889c08e-7378-47f1-9830-a03f87abb18f';
const BOUNDS={start:'2026-11-01',endExclusive:'2026-12-01'};
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

const database=(rows,{failure}={})=>({calls:[],from(table){
 const owner=this;
 const query={
  select(){return query},
  eq(){return query},
  gte(){return query},
  lt(){return query},
  order(column,options){assert.equal(column,'id');assert.deepEqual(options,{ascending:true});return query},
  range(from,to){
   owner.calls.push({table,from,to});
   return Promise.resolve(failure?{data:null,error:{message:failure}}:
    {data:rows.slice(from,to+1),error:null});
  }
 };
 return query;
}});

test('relatório traz mais de 2.500 eventos sem corte silencioso',async()=>{
 const rows=Array.from({length:2501},(_,index)=>({id:index+1}));
 const db=database(rows);
 const result=await fetchLexisAttendanceRows(db,COMPANY,BOUNDS,{pageSize:500});
 assert.equal(result.length,2501);
 assert.deepEqual(db.calls.map(call=>call.from),[0,500,1000,1500,2000,2500]);
});

test('paginação mantém os eventos recentes no início do relatório',async()=>{
 const rows=[
  {id:1,data_realizacao:'2026-11-01',created_at:'2026-11-01T10:00:00Z'},
  {id:2,data_realizacao:'2026-11-03',created_at:'2026-11-03T10:00:00Z'},
  {id:3,data_realizacao:'2026-11-02',created_at:'2026-11-02T10:00:00Z'}
 ];
 const result=await fetchLexisAttendanceRows(database(rows),COMPANY,BOUNDS,{pageSize:2});
 assert.deepEqual(result.map(row=>row.id),[2,3,1]);
});

test('erro de leitura e limite de segurança não viram relatório parcial',async()=>{
 await assert.rejects(fetchLexisAttendanceRows(database([],{failure:'RLS recusou'}),COMPANY,BOUNDS),/RLS recusou/);
 const rows=Array.from({length:40},(_,index)=>({id:index+1}));
 await assert.rejects(fetchLexisAttendanceRows(database(rows),COMPANY,BOUNDS,{pageSize:20,maxRows:40}),/limite de segurança/);
});

test('telas de relatório usam o carregador paginado em vez de limit 2500',()=>{
 for(const path of ['components/lexis-shared-office.jsx','app/report/page.jsx']){
  const source=read(path);
  assert.match(source,/fetchLexisAttendanceRows/);
  assert.doesNotMatch(source,/tarefas_realizadas[\s\S]{0,500}limit\(2500\)/);
 }
});
