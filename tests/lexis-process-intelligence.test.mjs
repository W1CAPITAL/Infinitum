import test from 'node:test';
import assert from 'node:assert/strict';
import {
 loadLexisProcessIntelligence,normalizeLexisCase,classifyFasesProvas,
 listProcessosParados,exportFasesCsv,exportParadosCsv,loadHandledParados,saveHandledParado
} from '../lib/lexis-process-intelligence.mjs';

const company='company-1',user='user-1';
const profile={auth_user_id:user,empresa_id:company,nome:'Operador'};
const base={
 id:1,empresa_id:company,cliente:'Cliente Exemplo',protocolo_ref:'1000000-01.2025.8.26.0001',
 status:'EM ANDAMENTO',status_interno:'EM ANDAMENTO',observacoes:'',dados:{},
 datajud_ultimo_movimento:null,datajud_ultimo_nome:null,datajud_consultado_em:null,
 djen_ultima_data:null,djen_ultimo_resumo:null,djen_consultado_em:null,
 ultimo_retorno:null,proximo_retorno:null,advogado:'Dra. Ana',tribunal:'TJSP',escritorio:'W1'
};
function fakeDb({profiles=[profile],rows=[base]}={}){
 const calls=[];
 return {
  calls,
  from(table){
   if(table==='usuarios'){
    return {select(){
     return {eq(field,value){
      assert.equal(field,'auth_user_id');assert.equal(value,user);
      return {limit:async n=>{assert.equal(n,2);return {data:profiles,error:null}}};
     }};
    }};
   }
   if(table==='processos'){
    return {select(fields){
     assert.ok(fields.includes('datajud_ultimo_nome'));assert.ok(fields.includes('evento_tipo:dados->>evento_tipo'));assert.ok(!fields.split(',').includes('dados'));
     return {eq(field,value){
      assert.equal(field,'empresa_id');assert.equal(value,company);
      return {order(col,opt){
       assert.equal(col,'id');assert.deepEqual(opt,{ascending:true});
       return {range:async(from,to)=>{
        calls.push([from,to]);return {data:rows.slice(from,to+1),error:null};
       }};
      }};
     }};
    }};
   }
   throw Error('tabela inesperada '+table);
  }
 };
}
test('carteira jurídica: exige vínculo único e carrega páginas completas da empresa',async()=>{
 const rows=Array.from({length:5},(_,i)=>({...base,id:i+1}));
 const db=fakeDb({rows});
 const result=await loadLexisProcessIntelligence(db,user,{pageSize:2,maxRows:8});
 assert.equal(result.companyId,company);assert.equal(result.cases.length,5);
 assert.deepEqual(db.calls,[[0,1],[2,3],[4,5]]);
 assert.equal(result.cases[0].protocolo,'1000000-01.2025.8.26.0001');
});
test('carteira jurídica: falha fechada para perfil duplicado ou sem empresa',async()=>{
 await assert.rejects(loadLexisProcessIntelligence(fakeDb({profiles:[profile,profile]}),user),/vínculo único/i);
 await assert.rejects(loadLexisProcessIntelligence(fakeDb({profiles:[{...profile,empresa_id:null}]}),user),/vínculo único/i);
});
test('carteira jurídica: rejeita resposta que contenha linha de outra empresa',async()=>{
 await assert.rejects(loadLexisProcessIntelligence(fakeDb({rows:[{...base,empresa_id:'company-2'}]}),user),/outra empresa/i);
});
test('carteira jurídica: não publica snapshot parcial se limite de registros for atingido',async()=>{
 const rows=Array.from({length:2},(_,i)=>({...base,id:i+1}));
 await assert.rejects(loadLexisProcessIntelligence(fakeDb({rows}),user,{pageSize:2,maxRows:2}),/limite.*segurança/i);
});
test('normalização: mescla campos de dados sem sobrescrever a fonte canônica',()=>{
 const row=normalizeLexisCase({...base,cliente:'Nome canônico',observacoes:'Registro direto',dados:{
  cliente:'Nome antigo',situacao:'EM ANDAMENTO',evento_tipo:'intimacao',evento_resumo:'Intimação para provas',
  evento_data:'2026-11-10',statusManual:'EM ANDAMENTO',classe_acao:'Procedimento comum'
 }});
 assert.equal(row.cliente,'Nome canônico');assert.equal(row.situacao,'EM ANDAMENTO');
 assert.equal(row.evento_tipo,'intimacao');assert.equal(row.classe_acao,'Procedimento comum');
 assert.equal(row.observacao,'Registro direto');
});
test('fases e provas: prioriza intimação oficial mais recente e não inventa prazo',()=>{
 const [row]=classifyFasesProvas([{...base,observacoes:'Provas pendentes',
  datajud_ultimo_nome:'Provas apresentadas',datajud_ultimo_movimento:'2026-11-04',
  djen_ultimo_resumo:'Intimada a parte autora para especificação de provas',djen_ultima_data:'2026-11-10'}]);
 assert.equal(row.tipo,'provas');assert.equal(row.nivel,'tribunal');assert.equal(row.categoria,'intimacao');
 assert.equal(row.prioridade,'alta');assert.equal(row.dataMovimento,'10/11/2026');
 assert.match(row.motivo,/não é calculado nem confirmado/);
});
test('fases e provas: apresentação no cadastro não comprova protocolo',()=>{
 const [row]=classifyFasesProvas([{...base,observacoes:'Réplica apresentada conforme anotação.'}]);
 assert.equal(row.nivel,'cadastro');assert.equal(row.categoria,'enviado');
 assert.match(row.motivo,/não há comprovante de protocolo/);
});
test('fases e provas: negação de juntada continua como pendência',()=>{
 const [row]=classifyFasesProvas([{...base,observacoes:'Não foram apresentadas as provas solicitadas.'}]);
 assert.equal(row.categoria,'pendencia');assert.equal(row.prioridade,'alta');
});
test('fases e provas: ignora processo encerrado e deduplica por CNJ e etapa',()=>{
 const item={...base,observacoes:'Réplica juntada e provas especificadas'};
 assert.equal(classifyFasesProvas([item]).length,2);
 assert.equal(classifyFasesProvas([{...item,status_interno:'ENCERRADO'}]).length,0);
 assert.equal(classifyFasesProvas([item,item]).length,2);
});
test('fases e provas: CSV preserva acentos e neutraliza fórmulas',()=>{
 const [row]=classifyFasesProvas([{...base,cliente:'=HYPERLINK("https://example.test")',observacoes:'Juntada de provas'}]);
 const csv=exportFasesCsv([row]);assert.match(csv,/"'=HYPERLINK/);assert.match(csv,/Cliente/);assert.match(csv,/Réplica/);
});
test('processos parados: usa o último sinal oficial, não a data de consulta',()=>{
 const [row]=listProcessosParados([{...base,observacao:'Contestação apresentada',
  datajud_ultimo_nome:'Juntada de contestação',datajud_ultimo_movimento:'2026-10-01',
  datajud_consultado_em:'2026-11-20'}],15,{now:new Date('2026-11-23T12:00:00Z')});
 assert.equal(row.estado,'parado_confirmado');assert.equal(row.diasParadoTribunal,53);assert.equal(row.fonteData,'datajud');
});
test('processos parados: sinal só de consulta é sem_scan, nunca parada confirmada',()=>{
 const [row]=listProcessosParados([{...base,observacao:'Contestação apresentada',datajud_consultado_em:'2026-11-20'}],15,{now:new Date('2026-11-23T12:00:00Z')});
 assert.equal(row.estado,'sem_scan');assert.equal(row.diasParadoTribunal,0);
});
test('processos parados: ignora custas isoladas e processos encerrados',()=>{
 const rows=listProcessosParados([
  {...base,observacao:'Aguardando pagamento de custas e emissão de guia'},
  {...base,id:2,observacao:'Contestação apresentada',status_interno:'ENCERRADO'}
 ],15,{now:new Date('2026-11-23T12:00:00Z')});
 assert.equal(rows.length,0);
});
test('processos parados: contestação sem réplica cria providência; cumprimento satisfeito sai da fila',()=>{
 const [row]=listProcessosParados([{...base,observacao:'Contestação apresentada',
  datajud_ultimo_nome:'Contestação juntada',datajud_ultimo_movimento:'2026-09-01'}],15,{now:new Date('2026-11-23T12:00:00Z')});
 assert.ok(row.replicaPendente);assert.ok(row.oportunidades.some(x=>/réplica/i.test(x)));
 const paid=listProcessosParados([{...base,em_cumprimento_sentenca:true,dados:{cumprimento_satisfeito:true},
  observacao:'Cumprimento de sentença, pagamento integral',datajud_ultimo_movimento:'2026-09-01'}],15,{now:new Date('2026-11-23T12:00:00Z')});
 assert.equal(paid.length,0);
});
test('processos parados: menção genérica não cria providência se houve movimento recente',()=>{
 const rows=listProcessosParados([{...base,observacao:'Cliente pediu uma atualização sobre o processo',
  datajud_ultimo_nome:'Movimentação processual',datajud_ultimo_movimento:'2026-11-22'}],15,{now:new Date('2026-11-23T12:00:00Z')});
 assert.equal(rows.length,0);
});
test('processos parados: marcação tratado é isolada por empresa e usuário',()=>{
 const store={data:new Map(),getItem(k){return this.data.get(k)||null},setItem(k,v){this.data.set(k,v)}};
 const key=saveHandledParado('1000000-01.2025.8.26.0001',{companyId:company,userId:user,store,day:'2026-11-23'});
 assert.match(key,/company-1/);
 assert.equal(loadHandledParados({companyId:company,userId:user,store})['1000000-01.2025.8.26.0001'],'2026-11-23');
 assert.deepEqual(loadHandledParados({companyId:'company-2',userId:user,store}),{});
});
test('processos parados: exportação neutraliza fórmulas do cadastro',()=>{
 const [row]=listProcessosParados([{...base,cliente:'=SUM(1+1)',observacao:'Contestação apresentada',
  datajud_ultimo_nome:'Contestação juntada',datajud_ultimo_movimento:'2026-10-01'}],15,{now:new Date('2026-11-23T12:00:00Z')});
 const csv=exportParadosCsv([row]);assert.match(csv,/"'=SUM/);
});
