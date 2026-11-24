import test from 'node:test';
import assert from 'node:assert/strict';
import {loadLexisIntelligence,summarizeLexisSnapshots,toLexisIntelligenceCsv} from '../lib/lexis-intelligence.mjs';

const userId='operator-1',companyId='empresa-1';
const profile={auth_user_id:userId,empresa_id:companyId,nome:'Operadora'};
const sampleReport={
 empresa_id:companyId,
 portfolio:{total:2735,ativos:529,encerrados:2206,vencidos:0,novidades:313},
 historico:{eventos:52,processos:27,dias:[{day:'2026-11-20',atendimentos:9},{day:'2026-11-21',atendimentos:0}]},
 retorno:{antigos:24,nuncaRegistrado:11},
 trabalho:{registros:3},
 equipe:{pessoas:[{userId:'staff-1',nome:'Maria',cargo:'Supervisora',
  carteira:{total:200,ativos:50,encerrados:150},
  atendimentos:{processos:5,eventos:8},
  atividades:{registrosTotal:12}}]}
};
const sampleSupervision={
 empresa_id:companyId,
 carteira:{total:2735,ativos:529,encerrados:2206,semRetorno:101,novidades:313,
 porStatus:[{label:'EM ANDAMENTO',value:529}],
 porTribunal:[{label:'TJSP',value:1000}]},
 atividade:{edicoesEventos:90,edicoesProcessos:48,timeline:[{label:'18/11',atendidos:8}]},
 status:{}
};
function db({profiles=[profile],results={},calls=[]}={}){
 return {
  from:table=>{assert.equal(table,'usuarios');return{
   select:()=>({eq:(field,value)=>{assert.equal(field,'auth_user_id');assert.equal(value,userId);
    return{limit:async num=>{assert.equal(num,2);return{data:profiles,error:null}}}}})
  }},
  rpc:async(name,args)=>{calls.push({name,args});return results[name]??{data:null,error:{message:'RPC indisponível'}}}
 };
}
test('Relatórios: dados apenas da empresa vinculada, nunca parâmetros de empresa enviados na RPC',async()=>{
 const calls=[];
 const res=await loadLexisIntelligence(db({calls,results:{
  lexis_desktop_relatorio_snapshot:{data:sampleReport,error:null}
 }}),userId,{period:'mes',area:'report'});
 assert.equal(res.report.portfolio.total,2735);
 assert.equal(res.companyId,companyId);
 assert.deepEqual(calls,[{name:'lexis_desktop_relatorio_snapshot',args:{p_periodo:'mes',p_owner:null}}]);
});
test('Supervisão: utiliza as duas consultas autenticadas e separa dados atuais dos dados do período',async()=>{
 const calls=[];
 const result=await loadLexisIntelligence(db({calls,results:{
  lexis_desktop_supervisao_snapshot:{data:sampleSupervision,error:null},
  lexis_desktop_relatorio_snapshot:{data:sampleReport,error:null}
 }}),userId,{period:'mes',area:'supervision'});
 assert.equal(result.supervision.carteira.total,2735);
 assert.equal(result.report.historico.eventos,52);
 assert.equal(calls.length,2);
 assert.deepEqual(calls.map(x=>Object.keys(x.args)),[['p_periodo'],['p_periodo','p_owner']]);
});
test('RLS: nega perfil sem vínculo único, antes de consultar indicadores',async()=>{
 let called=false;
 const client=db({profiles:[profile,profile]});client.rpc=async()=>{called=true;return{}};
 await assert.rejects(loadLexisIntelligence(client,userId,{area:'report'}),/vínculo único/i);
 assert.equal(called,false);
});
test('RLS: rejeita resposta de outra empresa sem exibi-la',async()=>{
 const client=db({results:{lexis_desktop_relatorio_snapshot:{
  data:{...sampleReport,empresa_id:'outra-empresa'},error:null
 }}});
 await assert.rejects(loadLexisIntelligence(client,userId,{area:'report'}),/empresa.*sessão/i);
});
test('Supervisão: permissão negada não vira zero nem relatório aberto para operador',async()=>{
 const client=db({results:{
  lexis_desktop_supervisao_snapshot:{data:null,error:{code:'42501',message:'permission denied'}},
  lexis_desktop_relatorio_snapshot:{data:sampleReport,error:null}
 }});
 await assert.rejects(loadLexisIntelligence(client,userId,{area:'supervision'}),/permissão|Supervisor/i);
});
test('Indisponibilidade não vira KPI zerado; zero verdadeiro permanece zero',()=>{
 const summary=summarizeLexisSnapshots({report:sampleReport,supervision:sampleSupervision});
 assert.equal(summary.headline.total,2735);
 assert.equal(summary.headline.vencidos,0);
 assert.equal(summary.headline.semRetorno,101);
 assert.equal(summary.headline.atendimentos,52);
 assert.equal(summary.timeline[0].count,9);
 assert.equal(summary.team[0].nome,'Maria');
 const unavailable=summarizeLexisSnapshots({report:{empresa_id:companyId,portfolio:{total:2735},historico:{}},supervision:null});
 assert.equal(unavailable.headline.ativos,null);
 assert.equal(unavailable.headline.atendimentos,null);
 assert.deepEqual(unavailable.team,[]);
});
test('CSV exportado contém números reais, preserva acentos e neutraliza fórmulas',()=>{
 const summary=summarizeLexisSnapshots({report:sampleReport,supervision:sampleSupervision});
 const csv=toLexisIntelligenceCsv(summary,'mes');
 assert.match(csv,/"Total de processos";"2735"/);
 assert.match(csv,/"Atendimentos no período";"52"/);
 assert.match(csv,/Maria/);
 const modified={...summary,team:[{...summary.team[0],nome:'=CMD()'}]};
 assert.match(toLexisIntelligenceCsv(modified,'mes'),/"'=CMD\(\)"/);
});
test('Períodos inválidos não são encaminhados ao banco',async()=>{
 await assert.rejects(loadLexisIntelligence(db(),userId,{period:'ano',area:'report'}),/Período inválido/);
});

test('relatório real usa o agregado histórico de tarefas autenticado por responsável',async()=>{
 const data={...sampleReport,atividadesRegistradas:{total:1527,porResponsavel:[{userId:'staff-1',registros:1408,processos:900,contatosMarcados:1145,semReferencia:2}]}};
 const result=await loadLexisIntelligence(db({results:{lexis_desktop_relatorio_snapshot:{data,error:null}}}),userId,{area:'report'});
 const person=result.report.equipe.pessoas[0];
 assert.equal(person.atividades.registrosTotal,1408);
 assert.equal(person.atividades.processosTotal,900);
 assert.equal(person.atividades.contatosMarcadosTotal,1145);
 assert.equal(person.atividades.semReferenciaTotal,2);
 assert.equal(summarizeLexisSnapshots(result).headline.atividadesHistorico,1527);
 assert.equal(summarizeLexisSnapshots(result).headline.atividades,3);
 assert.equal(data.equipe.pessoas[0].atividades.registrosTotal,12);
});

test('supervisão expõe auditorias e tarefas por responsável sem somar como atendimentos',()=>{
 const supervision={...sampleSupervision,analises:{totalRegistros:42,processosAnalisados:20,auditoriaSistemica:10,triagemReplicaProvas:0,tarefasConcluidas:1527,tarefasConcluidasPeriodo:51,tarefasPorPessoa:[{nome:'Maria',total:120,periodo:12}]}};
 const result=summarizeLexisSnapshots({supervision,report:sampleReport});
 assert.equal(result.analysis.totalRegistros,42);
 assert.equal(result.analysis.triagemReplicaProvas,0);
 assert.equal(result.analysis.auditoriaDocumental,null);
 assert.equal(result.analysis.tarefasConcluidas,1527);
 assert.deepEqual(result.analysis.tarefasPorPessoa,[{nome:'Maria',total:120,periodo:12}]);
 assert.equal(result.headline.atendimentos,52);
 assert.equal(summarizeLexisSnapshots({supervision:sampleSupervision}).analysis,null);
 assert.match(toLexisIntelligenceCsv(result,'mes'),/"Processos analisados";"20"/);
});
