import test from 'node:test';
import assert from 'node:assert/strict';
import {filterLexisCompanyQueue, summarizeLexisCompanyQueue} from '../lib/lexis-company-queue.mjs';

const TODAY='2026-11-23';
const rows=[
 {id:'r1',kind:'retorno',status:'vencido',due_on:'2026-11-18',title:'Retorno atrasado',process_number:'0000001-00.2026.8.26.0001'},
 {id:'t1',kind:'tarefa',status:'em_dia',due_on:'2026-11-26',title:'Revisar provas',responsible:'Ana'},
 {id:'m1',kind:'tarefa',status:'encerrado',due_on:'2026-11-10',title:'Compromisso concluído'},
 {id:'r2',kind:'retorno',status:'atendido',due_on:'2026-11-20',title:'Retorno atendido'},
 {id:'t2',kind:'tarefa',status:'sem_data',due_on:null,title:'Tarefa sem data'},
 {id:'a1',kind:'audiencia',status:'vencido',due_on:'2026-11-18',title:'Audiência passada'}
];

test('fila de vencidos mostra apenas pendências vencidas, sem misturar audiências',()=>{
 assert.deepEqual(filterLexisCompanyQueue(rows,{view:'vencidos',today:TODAY}).map(x=>x.id),['r1']);
});

test('fila de prioridades mantém pendências abertas e remove itens concluídos ou atendidos',()=>{
 assert.deepEqual(filterLexisCompanyQueue(rows,{view:'prioridades',today:TODAY}).map(x=>x.id),['r1','t1','t2']);
});

test('busca da fila procura cliente, CNJ, responsável e título',()=>{
 assert.deepEqual(filterLexisCompanyQueue(rows,{view:'todos',today:TODAY,query:'0000001-00'}).map(x=>x.id),['r1']);
 assert.deepEqual(filterLexisCompanyQueue(rows,{view:'todos',today:TODAY,query:'ana'}).map(x=>x.id),['t1']);
});

test('filtro de concluídos inclui tarefas encerradas e retornos atendidos',()=>{
 assert.deepEqual(filterLexisCompanyQueue(rows,{view:'finalizados',today:TODAY}).map(x=>x.id),['r2','m1']);
});

test('resumo separa pendências, vencidos, em dia, sem data e finalizados',()=>{
 assert.deepEqual(summarizeLexisCompanyQueue(rows,TODAY),{
  total:5,abertas:3,vencidos:1,hoje:0,em_dia:1,sem_data:1,finalizados:1,atendidos:1
 });
});
