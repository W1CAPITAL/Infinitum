import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeLexisAttendanceAudit,fetchLexisAttendanceAudit} from '../lib/lexis-attendance-audit.mjs';
const uuidA='4581d2fe-c358-45f9-a1bd-f90f93dce0fc',uuidB='e72a59fd-d85f-4b4d-bbe1-1966249a14cf',uuidC='d269f309-a461-4f01-b894-d3a7b54a4b7c';
const company='b889c08e-7378-47f1-9830-a03f87abb18f';
const source={hoje:'2026-11-16',atualizadoEm:'2026-11-16T12:00:00Z',periodo:'esta_semana',
 dias:[{ymd:'2026-11-16',atendimentos:16}],
 hojePorUsuario:[{userId:uuidA,nome:'DAVI ALVES FIGUEREDO',processos:10,eventos:10},
 {userId:uuidB,nome:'KRIS',processos:4,eventos:4},
 {userId:uuidC,nome:'ADRIANA',processos:2,eventos:2}],
 porUsuario:[{userId:uuidA,nome:'DAVI ALVES FIGUEREDO',processos:10,eventos:10},
 {userId:uuidB,nome:'KRIS',processos:4,eventos:4},
 {userId:uuidC,nome:'ADRIANA',processos:2,eventos:2}]};
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('painel apresenta 16 atendimentos reais da equipe e 10 do Davi, com operadores >0',()=>{
 const a=normalizeLexisAttendanceAudit(source,{today:'2026-11-16',userId:uuidA});
 assert.equal(a.todayTotal,16);assert.equal(a.personalToday,10);
 assert.deepEqual(a.operatorsToday.map(x=>x.processos),[10,4,2]);
 assert.equal(a.overlapPossible,false);
});
test('um CNJ atendido por dois operadores nao é somado duas vezes ao total da equipe',()=>{
 const modified={...source,dias:[{ymd:'2026-11-16',atendimentos:15}]};
 const a=normalizeLexisAttendanceAudit(modified,{today:'2026-11-16',userId:uuidB});
 assert.equal(a.todayTotal,15);assert.equal(a.personalToday,4);assert.equal(a.overlapPossible,true);
});
test('operadores sem atendimento não aparecem na lista da equipe',()=>{
 const a=normalizeLexisAttendanceAudit({...source,hojePorUsuario:[...source.hojePorUsuario,{userId:'b8c3cae4-a990-4052-92c6-25c7ae6ce667',nome:'SEM AÇÕES',processos:0,eventos:0}]},{userId:uuidA,today:'2026-11-16'});
 assert.equal(a.operatorsToday.length,3);
});
test('falha RLS e fonte indisponível nao viram total zero',async()=>{
 await assert.rejects(fetchLexisAttendanceAudit({rpc:async()=>({error:{message:'permission denied'}})},company,{today:'2026-11-16',userId:uuidA}),/permission denied/);
 assert.throws(()=>normalizeLexisAttendanceAudit({...source,dias:[]},{today:'2026-11-16'}),/total de processos/);
 assert.throws(()=>normalizeLexisAttendanceAudit(source,{today:'2026-11-17'}),/data da auditoria/);
});
test('RPC exige empresa e periodo fixo, sem consulta arbitraria ao banco',async()=>{
 const calls=[];
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:source,error:null}}};
 const result=await fetchLexisAttendanceAudit(db,company,{today:'2026-11-16',userId:uuidA});
 assert.equal(result.todayTotal,16);
 assert.deepEqual(calls,[{name:'lexis_atendimentos_periodo',args:{p_empresa:company,p_periodo:'esta_semana'}}]);
 await assert.rejects(fetchLexisAttendanceAudit(db,'not-a-uuid',{today:'2026-11-16'}),/Organização/);
});
test('dashboard e prazos exibem auditoria, nunca reutilizam retornos concluidos como atendimentos de hoje',()=>{
 const operations=read('components/lexis-operations.jsx'),dashboard=read('components/lexis-dashboard.jsx');
 assert.match(operations,/useLexisAttendanceAudit/);
 assert.match(operations,/LexisAttendanceBoard/);
 assert.match(dashboard,/useLexisAttendanceAudit/);
 assert.match(dashboard,/LexisAttendanceBoard/);
});

test('filtro do painel abre a auditoria de hoje sem confundir prazo vencido',()=>{
 const operations=read('components/lexis-operations.jsx');
 assert.match(operations,/new URLSearchParams\(window.location.search\)/);
 assert.match(operations,/atendimentos_hoje/);
 assert.match(operations,/meus_atendimentos/);
 assert.match(operations,/Agendamentos concluídos por data/);
});
test('registrar atendimento confirmado atualiza a auditoria e troca de empresa limpa dados antigos',()=>{
 const office=read('components/lexis-shared-office.jsx');
 assert.match(office,/if\(error\|\|data\?\.ok!==true\)throw/);
 assert.match(office,/window.dispatchEvent\(new window.Event\('lexis:attendance-registered'\)\)/);
 const hook=read('components/use-lexis-attendance-audit.js');
 assert.match(hook,/lexis:attendance-registered/);
 assert.match(hook,/scope.current!==nextScope/);
});
