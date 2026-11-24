import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReportSections,executiveSeries,reportDistribution,answerReportQuestion} from '../lib/infinitum-report-executive.mjs';
test('report uses distinct actual Lexis snapshots, preserves zero vs unavailable',()=>{
 const snapshot={portfolio:{total:20,ativos:9,encerrados:10},merito:{oficial:{procedentes:2,improcedentes:0}},retorno:{semRetornoLongo:4,nuncaRegistrado:1},encerramentos:{processosManuais:5,testesAdministrativos:2},trabalho:{registros:8,processosDistintos:7,porCategoria:[{categoria:'auditoria',registros:4,processos:3}]}};
 const sections=buildReportSections(snapshot);
 const lookup=(id,label)=>sections.find(x=>x.id===id).metrics.find(x=>x.label===label).value;
 assert.equal(lookup('merito','Procedência identificada'),2);
 assert.equal(lookup('merito','Improcedência identificada'),0);
 assert.equal(lookup('merito','Procedência parcial identificada'),null);
 assert.equal(lookup('retornos','Sem retorno há 30 dias ou mais'),4);
 assert.equal(lookup('encerramentos','Processos encerrados manualmente'),5);
 assert.equal(lookup('trabalho','Registros de trabalho interno'),8);
 assert.equal(buildReportSections({})[0].metrics[0].value,null);
});
test('daily closure series is unavailable without matching authorized history',()=>{
 const history={dias:[{ymd:'2026-11-23',atendimentos:3},{ymd:'2026-11-24',atendimentos:0}],porUsuarioDia:[{ymd:'2026-11-23',encerramentos:2},{ymd:'2026-11-23',encerramentos:1}]};
 assert.deepEqual(executiveSeries(history).map(x=>x.encerramentos),[3,0]);
 assert.equal(executiveSeries({dias:history.dias})[0].encerramentos,null);
 assert.equal(reportDistribution({total:20,ativos:null,encerrados:10}),null);
 assert.deepEqual(reportDistribution({total:20,ativos:9,encerrados:10}).map(x=>x.value),[9,10,1]);
});
test('answers distinguish missing data and exact person rather than ambiguous first names',()=>{
 const model={headline:{total:20,vencidos:null},team:[{nome:'Maria Silva',atendimentos:{eventos:4}},{nome:'Maria Costa',atendimentos:{eventos:1}}]};
 assert.match(answerReportQuestion('Maria',model,[]),/mais de um/i);
 assert.match(answerReportQuestion('Maria Silva',model,[]),/4/);
 assert.match(answerReportQuestion('prioridades',model,[]),/indisponível/i);
});
