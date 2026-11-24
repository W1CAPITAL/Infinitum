import {classifyLexisReturn,hasProcessNumber} from './lexis-return-kpis.mjs';
// Leitura e apresentação do calendário oficial + operacional LexisPredict.
// Funções puras: não fazem consultas, não alteram o banco, não inventam resultados.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||'').slice(0,10))?String(x).slice(0,10):null;
const text=x=>String(x??'').trim();
const normalized=x=>text(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const validUrl=x=>{try{const u=new URL(x);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}};
export function responsibleDisplay(value,members=[]){
 const input=text(value);
 if(!input)return 'Não informado';
 const matches=(members||[]).filter(m=>m?.nome&&
  [m.id,m.auth_user_id,m.nome].some(x=>text(x).toLowerCase()===input.toLowerCase()));
 if(matches.length===1)return matches[0].nome;
 if(UUID.test(input))return 'Não identificado';
 return input;
}
export function processStatus(value){
 const original=text(value);
 const v=normalized(original);
 if(v==='ENCERRADO'||v==='FINALIZADO'||v==='EXCLUIDO')return {key:'encerrado',label:'Encerrado'};
 if(v==='EM ANDAMENTO'||v==='ATIVO'||v==='')return {key:'em_andamento',label:'Em andamento'};
 if(v==='VENCIDO')return {key:'vencido',label:'Vencido'};
 if(v==='NO PRAZO'||v==='EM DIA')return {key:'em_dia',label:'Em dia'};
 if(v.includes('PENDENTE')||v.includes('ATENCAO')||v.includes('NAO RESPONDE')||v.includes('IMOVEL'))
  return {key:'atencao',label:original?original.toLocaleLowerCase('pt-BR').replace(/^./,c=>c.toLocaleUpperCase('pt-BR')):'Atenção'};
 return {key:'atencao',label:original||'Atenção'};
}
export const isFinished=x=>['ENCERRADO','FINALIZADO','EXCLUIDO','ARQUIVADO'].includes(normalized(x));
export function statusForDate(date,{today,finished=false,canceled=false}={}){
 if(finished||canceled)return {key:'encerrado',label:canceled?'Cancelado':'Encerrado'};
 const due=day(date),t=day(today);
 if(!due)return {key:'sem_data',label:'Sem data'};
 if(!t)return {key:'em_dia',label:'Em dia'};
 if(due<t)return {key:'vencido',label:'Vencido'};
 const diff=Math.round((Date.parse(due+'T12:00:00Z')-Date.parse(t+'T12:00:00Z'))/86400000);
 if(diff<=3)return {key:'atencao',label:'Atenção'};
 return {key:'em_dia',label:'Em dia'};
}
function common(p,kind,id,due,display,members,today,other={}){
 const status=statusForDate(due,{today,finished:isFinished(p.status_interno)});
 return {id,kind,title:text(display)||'Item sem título',due_on:day(due),status:status.key,status_label:status.label,
  process_number:p.protocolo_ref||null,client_name:p.cliente||null,
  responsible:responsibleDisplay(p.atendido_por,members),
  court_status:processStatus(p.status_interno),source_url:null,notes:p.observacoes||'',...other};
}
// Menções, previsões e registros sem data nunca são compromissos agendados.
export function classifyMonitoredHearing(h={}){
 const date=day(h.data_evento);
 if(!date)return 'pendente';
 const d=new Date(date+'T12:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)return 'pendente';
 const status=normalized(h.situacao),source=normalized(h.fonte),evidence=normalized(h.evidencia);
 if(/CANCELAD|ADIAD|DESMARC|SUSPENS/.test(status))return 'encerrada';
 if(/PENDENTE|POSSIV|PREVIST|INDEFINID|MENCAO|NAO DESIGNAD/.test(status))return 'pendente';
 // Evita expressões hipotéticas que não determinam a realização do ato.
 if(/(?:AUDIENCIA|SESSAO).{0,50}(?:PODERA SER DESIGNADA|SERA OPORTUNAMENTE DESIGNADA|A SER DESIGNADA|SE NECESSARIO|CASO NECESSARIO)|(?:EVENTUAL|POSSIVEL|FUTURA) (?:AUDIENCIA|SESSAO)|(?:DISPENSO|DISPENSADA|DISPENSA DA) (?:A )?AUDIENCIA/.test(evidence))return 'pendente';
 if(!/^(PUBLICADA|DESIGNADA|AGENDADA|CONFIRMADA|INFORMADA|REALIZADA|REDESIGNADA)$/.test(status))return 'pendente';
 if(/SESSAO_VIRTUAL|SESSAO VIRTUAL/.test(normalized(h.tipo)))return 'sessao';
 if(status==='INFORMADA'||source==='NOTIFICACAO')return 'informada';
 return 'agendada';
}
export function buildLexisEvents({processes=[],hearings=[],tasks=[],manual=[],members=[],today}={}){
 const events=[];
 for(const p of processes||[]){
  const ret=classifyLexisReturn(p,today);
  if(!ret.valid||!ret.next)continue;
  // Proximo prazo antigo nao produz evento de vencimento.
  events.push(common(p,'retorno','return:'+p.id,ret.next,
   'Retorno · '+(p.cliente||p.protocolo_ref||'Processo'),members,today,{
    process_id:p.id,source:'LexisPredict · Retorno ao cliente',
    status:ret.status,status_label:ret.label,last_return:ret.last
   }));
 }
 for(const h of hearings||[]){
  if(!hasProcessNumber(h))continue;
  const hearingClass=classifyMonitoredHearing(h);
  if(hearingClass==='pendente')continue;
  const cancelada=hearingClass==='encerrada';
  const status=statusForDate(h.data_evento,{today,canceled:cancelada});
  events.push({id:'hearing:'+h.id,kind:'audiencia',due_on:day(h.data_evento),
   title:text(h.tipo)?h.tipo+' · '+(h.cliente||h.protocolo_ref||'Processo'):'Audiência · '+(h.cliente||h.protocolo_ref||'Processo'),
   status:status.key,status_label:status.label,hearing_class:hearingClass,
   process_id:h.processo_id??null,process_number:h.protocolo_ref||null,
   client_name:h.cliente||null,responsible:responsibleDisplay(h.advogado,members),
   court_status:{key:status.key,label:h.situacao||'Situação não informada'},source:hearingClass==='sessao'?'LexisPredict · Sessão de julgamento':hearingClass==='informada'?'LexisPredict · Notificação não verificada':'LexisPredict · Audiências',
   source_url:validUrl(h.fonte_url)||validUrl(h.portal_url)||null,
   hour:h.hora_local||'',end:h.hora_fim||'',timezone:h.fuso||'America/Sao_Paulo',
   notes:[h.tribunal,h.modalidade,h.situacao,hearingClass==='informada'?'Data informada, ainda não verificada em fonte oficial':null,h.evidencia].filter(Boolean).join(' · ')});
 }
 for(const t of tasks||[]){
  const status=statusForDate(t.due_at,{today,finished:t.feito===true});
  events.push({id:'task:'+t.id,kind:'tarefa',title:t.titulo||'Tarefa',
   due_on:day(t.due_at),status:status.key,status_label:status.label,
   responsible:responsibleDisplay(t.assignee_id,members),process_number:null,
   source:'LexisPredict · Tarefas',notes:'',task_id:t.id,assignee_id:t.assignee_id??null,source_url:null});
 }
 for(const d of manual||[]){
  const finished=['concluido','encerrado','cancelado','arquivado'].includes(normalized(d.status).toLowerCase());
  const status=statusForDate(d.due_on,{today,finished});
  events.push({id:'manual:'+d.id,kind:d.kind||'tarefa',title:d.title||'Compromisso',
   due_on:day(d.due_on),status:status.key,status_label:status.label,original_status:d.status,
   responsible:responsibleDisplay(d.responsible,members),process_number:null,source:'Infinitum · Manual',
   notes:d.notes||'',priority:d.priority||'normal',manual_id:d.id,source_url:null});
 }
 return events.sort((a,b)=>(a.due_on||'9999-12-31').localeCompare(b.due_on||'9999-12-31')||a.title.localeCompare(b.title,'pt-BR'));
}

export function filterAgendaEvents(items=[],{today,start,end,filter='todos',kind='todos',selectedDay='',responsible='todos'}={}){
 const next=new Date(today+'T12:00:00Z');
 next.setUTCDate(next.getUTCDate()+7);
 const until=Number.isFinite(next.getTime())?next.toISOString().slice(0,10):today;
 return items.filter(x=>{
  if(kind!=='todos'&&x.kind!==kind)return false;
  if(responsible!=='todos'&&x.responsible!==responsible)return false;
  if(selectedDay&&x.due_on!==selectedDay)return false;
  if(filter==='sem_data')return !x.due_on&&x.status==='sem_data';
  if(!x.due_on||(start&&x.due_on<start)||(end&&x.due_on>end))return false;
  if(filter==='todos')return true;
  if(filter==='hoje'||filter==='proximos')return !['atendido','encerrado'].includes(x.status)&&x.due_on>=today&&x.due_on<=(filter==='hoje'?today:until);
  if(filter==='retornos')return x.kind==='retorno';
  return x.status===filter;
 });
}
export function buildTaskEditPatch(form,team,companyId){
 const title=text(form.title),due=text(form.due_on),assignee=text(form.assignee_id);
 if(title.length<3||title.length>250)throw Error('Informe um título de 3 a 250 caracteres.');
 if(due){
  const d=new Date(due+'T12:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==due)throw Error('Data inválida.');
 }
 if(!companyId||assignee&&!(team||[]).some(m=>m.empresa_id===companyId&&[m.id,m.auth_user_id].some(id=>id===assignee)))throw Error('Responsável precisa pertencer à empresa.');
 return {titulo:title,due_at:due||null,assignee_id:assignee||null};
}
