// Inteligência processual compartilhada: regras portadas do LexisPredict.
// Só usa dados da carteira e últimos sinais DataJud/DJEN armazenados.
// Não cria prazo judicial, não envia mensagens e não altera processos.
import {resolveCompanyAccess} from './lexis-shared-portfolio.mjs';
import {fetchCompanyRows} from './lexis-company-data.mjs';

export const LEXIS_INTELLIGENCE_FIELDS=[
 'id','empresa_id','cliente','telefone','protocolo_ref','tribunal','advogado','escritorio',
 'status','status_interno','ultimo_retorno','proximo_retorno','proximo_prazo','observacoes',
 'datajud_ultimo_movimento','datajud_ultimo_nome','datajud_consultado_em','datajud_encerrado_tribunal',
 'datajud_encerrado_motivo','indicio_busca_apreensao','busca_apreensao_motivo','em_cumprimento_sentenca',
 'cumprimento_pendente_necessario','is_procedente','djen_consultado_em','djen_ultima_data',
 'djen_ultimo_resumo','djen_ultimo_link','classe_acao','updated_at','created_at',
 'situacao:dados->>situacao','statusManual:dados->>statusManual','fase:dados->>fase','fase_atual:dados->>fase_atual','fase_processual:dados->>fase_processual','evento_tipo:dados->>evento_tipo',
 'evento_resumo:dados->>evento_resumo','evento_data:dados->>evento_data',
 'cumprimento_satisfeito:dados->>cumprimento_satisfeito','alvara_levantado:dados->>alvara_levantado',
 'cumprimento_ativo:dados->>cumprimento_ativo','classe_processual:dados->>classe_processual',
 'movimento_nome:dados->>movimento_nome','protocolo:dados->>protocolo','numero_processo:dados->>numero_processo'
].join(',');

const clean=x=>String(x??'').trim();
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const first=(...values)=>values.find(x=>x!==null&&x!==undefined&&clean(x)!=='');
const flag=x=>x===true||x==='true'||x===1||x==='1';
export function normalizeLexisCase(row={}){
 const d=object(row.dados)?row.dados:{};
 const merged={...d,...row,dados:d};
 return {
  ...merged,
  id:row.id??d.id??null,empresa_id:row.empresa_id??d.empresa_id??null,
  cliente:clean(first(row.cliente,d.cliente,d.nome_cliente))||'Cliente não informado',
  protocolo:clean(first(row.protocolo_ref,row.protocolo,row.numero_processo,d.protocolo,d.numero_processo,d.cnj)),
  situacao:clean(first(d.situacao,row.situacao,row.status_interno,d.status_interno,row.status,d.status)),
  statusManual:clean(first(row.statusManual,d.statusManual,d.STATUS_MANUAL)),
  status_interno:clean(first(row.status_interno,d.status_interno)),
  observacao:clean(first(row.observacao,row.observacoes,d.observacao,d.observacoes)),
  observacoes:clean(first(row.observacoes,d.observacoes,d.observacao)),
  advogado:clean(first(row.advogado,d.advogado))||'Não atribuído',
  escritorio:clean(first(row.escritorio,d.escritorio)),
  tribunal:clean(first(row.tribunal,d.tribunal)),
  telefone:clean(first(row.telefone,d.telefone)),
  ultimoRetorno:first(row.ultimo_retorno,d.ultimoRetorno,d.ultimo_retorno)||null,
  proximoRetorno:first(row.proximo_retorno,d.proximoRetorno,d.proximo_retorno)||null,
  datajud_ultimo_movimento:first(row.datajud_ultimo_movimento,d.datajud_ultimo_movimento)||null,
  datajud_ultimo_nome:clean(first(row.datajud_ultimo_nome,d.datajud_ultimo_nome)),
  datajud_consultado_em:first(row.datajud_consultado_em,d.datajud_consultado_em)||null,
  djen_ultima_data:first(row.djen_ultima_data,d.djen_ultima_data,d.djen_ultimo_data)||null,
  djen_ultimo_resumo:clean(first(row.djen_ultimo_resumo,d.djen_ultimo_resumo)),
  djen_ultimo_link:clean(first(row.djen_ultimo_link,d.djen_ultimo_link)),
  djen_consultado_em:first(row.djen_consultado_em,d.djen_consultado_em)||null,
  fase:clean(first(row.fase,row.fase_atual,row.fase_processual,d.fase,d.fase_atual,d.fase_processual)),
  evento_tipo:clean(first(row.evento_tipo,d.evento_tipo)),
  evento_resumo:clean(first(row.evento_resumo,d.evento_resumo)),
  evento_data:first(row.evento_data,d.evento_data)||null,
  classe_acao:clean(first(row.classe_acao,row.classe_processual,d.classe_acao,d.classe,d.classe_processual)),
  datajud_encerrado_tribunal:row.datajud_encerrado_tribunal===true||d.datajud_encerrado_tribunal===true,
  datajud_encerrado_motivo:clean(first(row.datajud_encerrado_motivo,d.datajud_encerrado_motivo)),
  indicio_busca_apreensao:row.indicio_busca_apreensao===true||d.indicio_busca_apreensao===true,
  em_cumprimento_sentenca:row.em_cumprimento_sentenca===true||d.em_cumprimento_sentenca===true,
  cumprimento_pendente_necessario:row.cumprimento_pendente_necessario===true||d.cumprimento_pendente_necessario===true,
  is_procedente:flag(first(row.is_procedente,d.is_procedente)),
  cumprimento_satisfeito:flag(first(row.cumprimento_satisfeito,d.cumprimento_satisfeito)),
  alvara_levantado:flag(first(row.alvara_levantado,d.alvara_levantado)),
  cumprimento_ativo:flag(first(row.cumprimento_ativo,d.cumprimento_ativo))
 };
}
export async function loadLexisProcessIntelligence(db,userId,{pageSize=500,maxRows=20000}={}){
 if(!db?.from||!userId)throw Error('Sessão autenticada necessária.');
 const {data:profiles,error}=await db.from('usuarios').select('auth_user_id,empresa_id,nome')
  .eq('auth_user_id',userId).limit(2);
 if(error)throw Error('Não foi possível verificar a empresa da sessão: '+clean(error.message).slice(0,180));
 const profile=resolveCompanyAccess(profiles||[],userId);
 if(!profile)throw Error('Acesso negado: vínculo único com uma empresa não confirmado.');
 const rows=await fetchCompanyRows(db,'processos',LEXIS_INTELLIGENCE_FIELDS,profile.empresa_id,{pageSize,maxRows});
 if(rows.some(row=>row?.empresa_id!==profile.empresa_id))throw Error('A consulta retornou processo de outra empresa. A carteira não será exibida.');
 return {companyId:profile.empresa_id,profile,cases:rows.map(normalizeLexisCase),scanned:rows.length,complete:true};
}

// Réplica / provas — mesmas categorias e critérios do LexisPredict.
export const normalizePhaseText=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function formatFasesDate(value){
 if(!value)return 'Sem registro';
 const raw=String(value);
 if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){const [y,m,d]=raw.split('-');return d+'/'+m+'/'+y;}
 const date=new Date(raw);
 return Number.isNaN(date.getTime())?raw.slice(0,10):date.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
}
function eventTime(raw){
 if(!raw)return 0;
 const br=/^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(raw));
 if(br)return Date.UTC(Number(br[3]),Number(br[2])-1,Number(br[1]));
 const time=new Date(raw).getTime();return Number.isFinite(time)?time:0;
}
function snippet(value,max=260){const s=clean(value).replace(/\s+/g,' ');return s.length>max?s.slice(0,max-1)+'…':s;}
function valueOf(item,...keys){for(const k of keys){const value=item?.[k];if(value!==null&&value!==undefined&&clean(value))return String(value)}return '';}
function isClosed(item){
 const d=object(item?.dados)?item.dados:{};
 const status=String(first(item?.status,d.status)||'').toUpperCase();
 const situ=String(first(item?.situacao,d.situacao,item?.status_interno,d.status_interno)||'').toUpperCase();
 const manual=String(first(item?.statusManual,d.statusManual,d.STATUS_MANUAL)||'').toUpperCase();
 const blob=[status,situ,manual,item?.status_interno,d.status_interno].join(' ').toUpperCase();
 if(/AGUARD\.?\s*PROTOCOLO|PROTOCOLO\s*DO\s*TJ/.test(blob)&&!/ENCERRAD|ARQUIV|EXTINTO|BAIXA DEFINITIVA/.test(blob))return false;
 const closed=x=>/\bENCERRAD[OA]\b|ARQUIVAD|ARQUIVAMENTO|EXTINTO|EXTINÇÃO|EXTINCAO|BAIXA DEFINITIVA|FINALIZAD[OA]/.test(String(x||'').toUpperCase());
 if(closed(situ)||closed(manual)||closed(item?.status_interno)||closed(d.status_interno))return true;
 return ['ENCERRADO','ARQUIVADO','EXTINTO','BAIXA DEFINITIVA','ARQUIVAMENTO'].some(x=>blob.includes(x));
}
function isAboutType(text,type){
 const n=normalizePhaseText(text).replace(/_/g,' ');
 return type==='replica'?/\breplica\b|(?:impugnacao|manifestacao) (?:a|da|sobre a) contestacao/.test(n):
  /\bprovas?\b|\bpericia\b|\bpericial\b|\blaudo\b|\binstrucao probatoria\b|especificacao de provas|\bsaneamento\b|\bdilacao probatoria\b/.test(n);
}
const decision=/\bsentenca\b|improceden|proceden|transito em julgado|extincao do processo|arquivamento definitivo|baixa definitiva|cumprimento de sentenca/;
const request=/\bintimad[oa]s?\b|\bintimacao\b|\bdetermin[ao]c?a?o?\b|\bdespacho\b|\bprazo para\b|\bprazo de\b|\bespecificacao de provas|\bmanifestar.s? sobre\b|\bapresentar\b|\bjuntar\b|\brequer[ae]r\b|\bproduzir\b/;
const sent=/\bprotocolad[ao]s?\b|\bapresentad[ao]s?\b|\bjuntad[ao]s?\b|\bentregu[ae]s?\b|\brealizad[ao]s?\b|\benviad[ao]s?\b/;
const pending=/\bpendente\b|\baguardand[oa]\b|\bprovidenciar\b|\bsolicitar\b|\bprecisa\b|\bfalta\b|\bnao apresentad[ao]\b|\bprazo decorrid[ao]\b|\bperda de prazo\b/;
const negative=/\b(?:nao|nunca)\b.{0,40}\b(?:apresentad[ao]s?|protocolad[ao]s?|juntad[ao]s?|enviad[ao]s?|realizad[ao]s?)\b/;
function findingFor(text,type,source){
 const n=normalizePhaseText(text),isReplica=type==='replica';
 if(decision.test(n))return{fase:'Movimento posterior à etapa',categoria:'decisao',prioridade:'media',acao:'Ler a decisão e atualizar a fase da carteira.',motivo:'O último registro consultado menciona uma decisão ou etapa posterior. Isso não demonstra que o processo inteiro acabou.'};
 if(negative.test(n)||/\bprazo decorrid[ao]\b|\bperda de prazo\b/.test(n))return{fase:'Ausência ou decurso anotado',categoria:'pendencia',prioridade:'alta',acao:isReplica?'Verificar o protocolo da réplica e eventual certidão de decurso.':'Verificar se as provas foram apresentadas e se existe prazo encerrado.',motivo:'O registro menciona ausência ou decurso. Não equivale à confirmação de perda de prazo pelo tribunal.'};
 if(!isReplica&&/\b(?:pericia|pericial|perito|laudo)\b/.test(n)){
  const delivered=sent.test(n)&&!negative.test(n);
  return{fase:delivered?'Laudo ou perícia com registro de juntada':'Perícia / laudo mencionado',categoria:'pericia',prioridade:delivered?'media':'alta',
   acao:delivered?'Verificar se haverá manifestação sobre o laudo.':'Identificar responsável, data e próxima providência da perícia.',
   motivo:source==='tribunal'?'O movimento consultado menciona a perícia; não comprova, sozinho, prazo de manifestação vigente.':'Informação encontrada no cadastro; verificar o andamento oficial se for necessária uma decisão jurídica.'};
 }
 const sentSpecific=sent.test(n)&&isAboutType(n,type);
 if(sentSpecific)return{fase:source==='tribunal'?'Juntada / apresentação mencionada no tribunal':'Envio informado no cadastro',categoria:'enviado',prioridade:'media',
  acao:isReplica?'Consultar a petição apresentada e acompanhar o despacho seguinte.':'Conferir quais documentos foram juntados e a próxima manifestação.',
  motivo:source==='tribunal'?'O último ato registrado contém referência explícita à apresentação; a natureza do documento e a fase vigente ainda dependem do teor.':'A anotação informa o envio; não há comprovante de protocolo verificado nesta triagem.'};
 if(request.test(n)&&isAboutType(n,type))return{fase:source==='tribunal'?'Intimação / determinação identificada':'Providência solicitada no cadastro',categoria:'intimacao',prioridade:'alta',
  acao:isReplica?'Abrir a intimação, conferir a data e organizar a réplica com o advogado.':'Ler a intimação e listar documentos ou provas que foram solicitados.',
  motivo:source==='tribunal'?'Há ato específico no último registro oficial consultado. O prazo atual não é calculado nem confirmado por esta triagem.':'O cadastro menciona providência; confira se há intimação oficial correspondente.'};
 if(pending.test(n)&&isAboutType(n,type))return{fase:isReplica?'Réplica pendente no cadastro':'Provas / documentos pendentes no cadastro',categoria:'pendencia',prioridade:'alta',
  acao:isReplica?'Localizar a contestação, a intimação e o comprovante de protocolo.':'Identificar os documentos faltantes e conferir o prazo com o advogado.',
  motivo:'Pendência descrita internamente, não confirmada automaticamente como prazo judicial aberto.'};
 return{fase:isReplica?'Réplica citada no histórico':'Provas citadas no histórico',categoria:'referencia',prioridade:'baixa',
  acao:isReplica?'Verificar o último ato antes de incluir na fila de réplica.':'Identificar se a referência exige alguma providência atual.',
  motivo:'A palavra aparece no registro, sem um ato específico de envio, intimação ou pendência.'};
}
export function classifyFasesProvas(cases=[],seen=new Set()){
 const rows=[];
 for(const item of cases||[]){
  if(isClosed(item))continue;
  const status=valueOf(item,'situacao','status_interno','status')||'Sem situação cadastrada';
  const cnj=valueOf(item,'protocolo','protocolo_ref').trim(),recordId=valueOf(item,'id','db_id');
  const keyBase=cnj.replace(/\D/g,'')||recordId;if(!keyBase)continue;
  const note=valueOf(item,'observacao','observacoes'),datajud=valueOf(item,'datajud_ultimo_nome'),djen=valueOf(item,'djen_ultimo_resumo');
  const phaseFields=[valueOf(item,'fase','fase_atual','fase_processual'),valueOf(item,'statusManual'),valueOf(item,'situacao'),valueOf(item,'status_interno'),valueOf(item,'status')].filter(Boolean);
  const eventText=[valueOf(item,'evento_tipo').replace(/_/g,' '),valueOf(item,'evento_resumo')].filter(Boolean).join(' · ');
  const events=[
   {text:datajud,source:'DataJud · último movimento',date:valueOf(item,'datajud_ultimo_movimento')},
   {text:djen,source:'DJEN · última publicação',date:valueOf(item,'djen_ultima_data'),link:valueOf(item,'djen_ultimo_link')},
   {text:eventText,source:'Evento registrado',date:valueOf(item,'evento_data')}
  ].filter(event=>event.text).sort((a,b)=>eventTime(b.date)-eventTime(a.date));
  const contestation=/\b(?:juntad[ao]|apresentad[ao]|ofertad[ao]|oferecid[ao]|protocolad[ao]|recebid[ao])\b.{0,60}\bcontestacao\b|\bcontestacao\b.{0,60}\b(?:juntad[ao]|apresentad[ao]|ofertad[ao]|oferecid[ao]|protocolad[ao]|recebid[ao])\b/;
  const possibleReplica=contestation.test(normalizePhaseText([note,...events.map(e=>e.text)].join(' ')))&&![note,...phaseFields,...events.map(e=>e.text)].some(t=>isAboutType(t,'replica'))&&!events.some(e=>decision.test(normalizePhaseText(e.text))||isAboutType(e.text,'provas'));
  for(const type of ['replica','provas']){
   const phase=phaseFields.find(text=>isAboutType(text,type));
   const mentioned=[note,...events.map(e=>e.text)].some(text=>isAboutType(text,type));
   const inferred=type==='replica'&&possibleReplica;
   if(!phase&&!mentioned&&!inferred)continue;
   const key=keyBase+':'+type;if(seen.has(key))continue;seen.add(key);
   const official=events.find(event=>isAboutType(event.text,type)||decision.test(normalizePhaseText(event.text)));
   const evidence=official||(phase?{text:phase,source:'Cadastro · fase atual',date:''}:isAboutType(note,type)?{text:note,source:'Cadastro · observação',date:''}:{text:events.find(e=>contestation.test(normalizePhaseText(e.text)))?.text||note,source:'Cadastro · contestação',date:''});
   const nivel=official&&official.source!=='Evento registrado'?'tribunal':'cadastro';
   let finding=findingFor(evidence.text,type,nivel);
   if(inferred)finding={fase:'Possível réplica após contestação',categoria:'pendencia',prioridade:'alta',acao:'Conferir se há réplica pendente ou já apresentada.',motivo:'Contestação registrada, sem confirmação de réplica ou etapa posterior. Conferir o processo.'};
   else if(phase&&finding.categoria==='referencia')finding={fase:'Fase registrada no cadastro',categoria:'pendencia',prioridade:'media',acao:type==='replica'?'Conferir se a réplica foi apresentada.':'Conferir a providência de provas ou perícia.',motivo:'A situação ou fase cadastrada indica esta etapa; conferir o andamento atual.'};
   const realLevel=finding.categoria==='referencia'?'mencao':nivel;
   const link=/^https:\/\//i.test(valueOf(item,'djen_ultimo_link'))?valueOf(item,'djen_ultimo_link'):'';
   rows.push({key,cnj,cliente:valueOf(item,'cliente')||'Cliente não informado',advogado:valueOf(item,'advogado')||'Não atribuído',
    escritorio:valueOf(item,'escritorio'),tribunal:valueOf(item,'tribunal'),status,tipo:type,...finding,nivel:realLevel,
    fonte:evidence.source,evidencia:snippet(evidence.text),proximoRetorno:valueOf(item,'proximoRetorno','proximo_retorno'),
    dataMovimento:evidence.date?formatFasesDate(evidence.date):'Sem registro',
    datajud:formatFasesDate(item.datajud_consultado_em),djen:formatFasesDate(item.djen_consultado_em),
    linkDjen:link,linkFase:isAboutType(djen,type)?link:'',dataPublicacao:valueOf(item,'djen_ultima_data'),
    faseCadastrada:phase||'',registroInterno:snippet(note,650),datajudUltimoNome:snippet(datajud,350),djenUltimoResumo:snippet(djen,350)});
  }
 }
 return rows;
}
const PRIORITY={alta:0,media:1,baixa:2};
export function sortTriageRows(rows){return [...rows].sort((a,b)=>PRIORITY[a.prioridade]-PRIORITY[b.prioridade]||a.cliente.localeCompare(b.cliente,'pt-BR')||a.tipo.localeCompare(b.tipo));}
export const TRIAGE_EXPORT_HEADERS=['Cliente','CNJ','Tipo','Situação identificada','Base da informação','Prioridade','Próxima ação','Por que esta classificação','Fonte','Trecho da evidência','Data do ato consultado','Situação na carteira','Advogado','Escritório','Tribunal','Próximo retorno cadastrado (não é prazo judicial)','Data da consulta DataJud','Data da consulta DJEN'];
export function excelSafeCell(value){const raw=String(value??'').replace(/\u0000/g,'').slice(0,4000);return /^[\s]*[=+\-@\t\r]/.test(raw)?"'"+raw:raw;}
export function exportTriageRow(row){return[row.cliente,row.cnj,row.tipo==='replica'?'Réplica':'Provas',row.fase,row.nivel==='tribunal'?'Ato registrado no tribunal':row.nivel==='cadastro'?'Registro interno':'Menção',row.prioridade==='alta'?'Prioridade alta':row.prioridade==='media'?'Prioridade média':'Prioridade baixa',row.acao,row.motivo,row.fonte,row.evidencia,row.dataMovimento,row.status,row.advogado,row.escritorio,row.tribunal,row.proximoRetorno,row.datajud,row.djen].map(excelSafeCell);}
function csv(rows){return '\uFEFF'+rows.map(line=>line.map(value=>'"'+String(value??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');}
export function exportFasesCsv(rows){return csv([TRIAGE_EXPORT_HEADERS,...(rows||[]).map(exportTriageRow)]);}

// Processos parados — critérios operacionais do LexisPredict, sem declarar prazo judicial.
export function parseDateLoose(raw){
 if(!raw||!clean(raw))return null;const s=clean(raw);
 const br=/^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
 if(br){const d=new Date(Number(br[3]),Number(br[2])-1,Number(br[1]));return Number.isNaN(d.getTime())?null:d;}
 const d=new Date(s.includes('T')?s:s.slice(0,10));return Number.isNaN(d.getTime())?null:d;
}
function daysSince(date,now){if(!date)return null;const ms=now.getTime()-date.getTime();return ms<0?0:Math.floor(ms/86400000);}
export function ultimaDataTribunal(c){
 const candidates=[
  {raw:c.datajud_ultimo_movimento,fonte:'datajud',resumo:c.datajud_ultimo_nome||c.evento_resumo||'Movimento DataJud',official:true},
  {raw:c.djen_ultima_data,fonte:'djen',resumo:c.djen_ultimo_resumo||'Publicação DJEN',official:true},
  {raw:c.evento_data,fonte:'evento',resumo:c.evento_resumo||'Evento unificado',official:true},
  {raw:c.datajud_consultado_em||c.djen_consultado_em,fonte:'scan',resumo:'Última consulta ao tribunal (sem movimento novo no cadastro)',official:false}
 ];
 const tribunal=candidates.filter(x=>x.official&&parseDateLoose(x.raw)).sort((a,b)=>parseDateLoose(b.raw)-parseDateLoose(a.raw))[0];
 if(tribunal)return{date:parseDateLoose(tribunal.raw),fonte:tribunal.fonte,raw:String(tribunal.raw),resumo:String(tribunal.resumo),temSinalTribunal:true};
 const scan=candidates.find(x=>!x.official&&parseDateLoose(x.raw));
 if(scan)return{date:parseDateLoose(scan.raw),fonte:'scan',raw:String(scan.raw),resumo:scan.resumo,temSinalTribunal:false};
 const ret=parseDateLoose(c.ultimoRetorno);
 if(ret)return{date:ret,fonte:'retorno',raw:String(c.ultimoRetorno),resumo:'Sem movimento de tribunal no cadastro — só último retorno da equipe',temSinalTribunal:false};
 return{date:null,fonte:'desconhecida',raw:null,resumo:'Sem data de movimento conhecida (auditar primeiro)',temSinalTribunal:false};
}
function processText(c){return[c.evento_tipo,c.evento_resumo,c.datajud_ultimo_nome,c.djen_ultimo_resumo,c.observacao,c.situacao].map(x=>String(x||'').toUpperCase()).join(' | ');}
function processBlob(c){return[c.evento_tipo,c.evento_resumo,c.datajud_ultimo_nome,c.djen_ultimo_resumo,c.datajud_encerrado_motivo,c.observacao,c.situacao,c.classe_acao,c.movimento_nome].map(x=>String(x||'').toUpperCase()).join(' | ');}
export function isCumprimentoRecebido(c){
 const txt=processBlob(c);
 if(c.cumprimento_satisfeito===true||c.alvara_levantado===true)return true;
 return /ALVAR[AÁ]\s+(EXPEDIDO|LEVANTADO|CUMPRIDO)|LEVANTAMENTO\s+(REALIZADO|EFETUADO|DE\s+VALORES)|VALORES?\s+(RECEBIDOS?|LEVANTADOS?|CREDITADOS?)|QUITA[CÇ][AÃ]O\s+(DO\s+D[EÉ]BITO|DA\s+OBRIGA)|OBRIGA[CÇ][AÃ]O\s+SATISFEITA|PAGAMENTO\s+(INTEGRAL|COMPROVADO|EFETUADO)|CUMPRIMENTO\s+(INTEGRAL|SATISFEITO|HOMOLOGADO)|EXTIN[CÇ][AÃ]O\s+PELO\s+PAGAMENTO/.test(txt);
}
export function detectFlagsFase(c){
 const txt=processBlob(c),type=String(c.evento_tipo||'').toLowerCase();
 const temSentenca=!!(c.em_cumprimento_sentenca||/sentenca_(procedente|improcedente|parcial)/.test(type)||type==='cumprimento_sentenca'||c.is_procedente||/\bSENTEN[CÇ]A\b|\bJULGADO\b|PROCED[EÊ]NCIA/.test(txt));
 const temContestacao=!!(/contest/.test(type)||/CONTESTA[CÇ][AÃ]O\s+(APRESENTAD|JUNTAD|OFERTAD|OFERECID|PROTOCOLAD|RECEBID|INTERPOST)|JUNTAD[AO].{0,50}CONTESTA|CONTESTA[CÇ][AÃ]O\s+(DA|DO)\s+R[EÉ]U|\bCONTESTA[CÇ][AÃ]O\b/.test(txt)&&!/PRAZO\s+(PARA\s+)?(A\s+)?CONTESTA/.test(txt));
 const temReplica=!!(/replica/.test(type)||/R[EÉ]PLICA\s+(APRESENTAD|JUNTAD|OFERTAD|OFERECID|PROTOCOLAD)|JUNTAD[AO].{0,50}R[EÉ]PLICA|MANIFESTA[CÇ][AÃ]O\s+SOBRE\s+A\s+CONTESTA|\bR[EÉ]PLICA\b/.test(txt)&&!/PRAZO\s+(PARA\s+)?(A\s+)?R[EÉ]PLICA/.test(txt));
 const temCitacao=/\bCITA[CÇ][AÃ]O\b|CITADO|MANDADO\s+DE\s+CITA/.test(txt),temAudiencia=/AUDI[EÊ]NCIA/.test(txt);
 const cumprimentoRecebido=isCumprimentoRecebido(c);
 const cumprimentoAberto=!cumprimentoRecebido&&(c.em_cumprimento_sentenca||type==='cumprimento_sentenca'||c.cumprimento_ativo||c.cumprimento_pendente_necessario||(temSentenca&&c.is_procedente));
 return{temContestacao,temSentenca,temReplica,cumprimentoRecebido,cumprimentoAberto:!!cumprimentoAberto,replicaPendente:temContestacao&&!temReplica&&!temSentenca,temCitacao,temAudiencia};
}
export function matchFiltrosFase(flags,active=[],days){
 if(!active.length)return true;
 for(const f of active){if(f==='sem_contestacao'&&flags.temContestacao)return false;if(f==='sem_sentenca'&&flags.temSentenca)return false;
  if(f==='sem_replica'&&flags.temReplica)return false;if(f==='replica_pendente'&&!flags.replicaPendente)return false;
  if(f==='cumprimento_aberto'&&!flags.cumprimentoAberto)return false;if(f==='janela_recente'&&(days==null||days>30))return false;}
 return true;
}
function onlyCustas(c){
 const txt=processText(c),has=/CUSTAS|TAXA JUDICIARIA|TAXA JUDICIÁRIA|GUIA GERADA|UFESP|RECOLHER\s+TAXA|PREPARO/.test(txt);
 if(!has)return false;
 const strong=c.em_cumprimento_sentenca||c.cumprimento_pendente_necessario||c.cumprimento_ativo||c.indicio_busca_apreensao||c.is_procedente||c.evento_tipo==='sentenca_procedente'||c.evento_tipo==='sentenca_improcedente'||c.evento_tipo==='cumprimento_sentenca'||/CUMPRIMENTO|EMBARGOS|RECURSO|APELACAO|APELAÇÃO|BUSCA E APREEN|AUDIENCIA|AUDIÊNCIA|PENHORA/.test(txt);
 return !strong;
}
function stillActionable(c){
 if(isClosed(c))return false;
 const sit=String(c.situacao||'').toUpperCase();if(sit==='ARQUIVADO'||sit==='ENCERRADO'||sit.includes('BAIXA DEFINITIVA'))return false;
 const txt=processText(c),baixa=!!c.datajud_encerrado_tribunal||/TRANSITO EM JULGADO|TRÂNSITO EM JULGADO|BAIXA DEFINITIVA|ARQUIVAMENTO DEFINITIVO/.test(txt);
 const residual=c.em_cumprimento_sentenca||c.cumprimento_pendente_necessario||c.cumprimento_ativo||/CUMPRIMENTO|EXECUCAO|EXECUÇÃO|HONORAR|EMBARGOS|RECURSO|APELACAO|APELAÇÃO/.test(txt)||c.is_procedente||c.evento_tipo==='sentenca_procedente'||c.evento_tipo==='cumprimento_sentenca'||c.evento_tipo==='sentenca_improcedente';
 if(baixa&&!residual)return false;
 if(isCumprimentoRecebido(c)&&(baixa||/EXTIN[CÇ][AÃ]O|ARQUIV/.test(txt)))return false;
 return true;
}
function opportunities(c,days,state){
 if(state==='sem_scan')return['Auditar DataJud + DJEN para saber a fase real do processo'];
 const out=[],f=detectFlagsFase(c),txt=processText(c);
 if(!f.cumprimentoRecebido&&(c.em_cumprimento_sentenca||c.evento_tipo==='cumprimento_sentenca'||c.cumprimento_ativo))out.push('Cumprimento em curso: conferir depósito, penhora, impugnação ou ato pendente');
 if(f.replicaPendente)out.push('Contestação nos autos: avaliar réplica ou manifestação no prazo');
 if(f.temCitacao&&!f.temContestacao&&!f.temSentenca)out.push('Citação sinalizada: conferir prazo de defesa e juntadas');
 if(f.temAudiencia)out.push('Audiência no histórico: confirmar pauta, acordo ou petição prévia');
 if(f.temContestacao&&!f.temReplica&&days>=7&&days<45)out.push('Janela recente após defesa: conferir prazo de réplica/manifestação');
 if(c.cumprimento_pendente_necessario||((c.is_procedente||c.evento_tipo==='sentenca_procedente')&&!c.em_cumprimento_sentenca))out.push('Sentença favorável: avaliar instauração ou andamento do cumprimento');
 if(c.evento_tipo==='sentenca_improcedente'||/IMPROCEDENTE/.test(txt))out.push('Improcedência: avaliar embargos de declaração / recurso no prazo');
 if(/GRATUIDADE|JUSTICA GRATUITA|JUSTIÇA GRATUITA|ASSISTENCIA JUDICIARIA/.test(txt))out.push('Justiça gratuita: juntar documentos ou cumprir intimação no processo');
 if(days>=30&&!c.datajud_encerrado_tribunal)out.push('Petição de impulso / cobrança de andamento no próprio processo');
 if(days>=90&&!c.datajud_encerrado_tribunal)out.push('Revisão da fase: saneamento, prova, conclusão ou recurso cabível');
 const ba=/BUSCA E APREEN|ALIENACAO FIDUCIARIA|ALIENAÇÃO FIDUCIÁRIA/.test(String(c.classe_acao||''))&&c.indicio_busca_apreensao&&/MANDADO|ORDEM DE BUSCA|LIMINAR/.test(processBlob(c));
 if(ba)out.push('Risco possessório/BA: medida urgente no processo (defesa / informação ao juízo)');
 if(/AUDIENCIA|AUDIÊNCIA/.test(txt)&&!/REALIZADA|CANCELADA|REDESIGNADA/.test(txt))out.push('Audiência: confirmar pauta e eventual petição prévia no processo');
 if(/DOCUMENTO|JUNTADA|INTIMACAO|INTIMAÇÃO PARA/.test(txt)&&days>=15)out.push('Intimação/documento: verificar se cabe resposta ou juntada no processo');
 if(c.datajud_encerrado_tribunal&&!isClosed(c))out.push('Tribunal sinaliza baixa: conferir alvará, cumprimento residual ou ato útil no processo');
 return out;
}
function scoreAction(days,daysNoReturn,c,state){
 if(state==='sem_scan')return 90+(daysNoReturn!=null?Math.min(60,daysNoReturn):30);
 let score=Math.min(420,Math.max(0,days)*2.2)+opportunities(c,days,state).length*35;
 const f=detectFlagsFase(c);
 if(f.cumprimentoRecebido)score=Math.round(score*.25);
 else if(c.em_cumprimento_sentenca||c.cumprimento_pendente_necessario)score+=80;
 if(f.replicaPendente)score+=55;if(f.cumprimentoAberto)score+=40;
 if(days<=30&&(f.replicaPendente||f.temCitacao))score+=50;
 if(c.is_procedente||c.evento_tipo==='sentenca_procedente')score+=70;
 if(c.indicio_busca_apreensao)score+=90;if(c.datajud_encerrado_tribunal)score+=25;
 if(daysNoReturn!=null&&daysNoReturn>45)score+=Math.min(40,daysNoReturn/3);
 return Math.round(state==='parado_provavel'?score*.7:score);
}
export const PARADOS_BANDS=[0,7,15,30,60,90,120,180];
export function listProcessosParados(cases=[],minDays=15,opts={}){
 const now=opts.now||new Date(),includeSemScan=opts.includeSemScan!==false,onlyConfirmed=!!opts.onlyConfirmados;
 const onlyActionable=opts.onlyAcionaveis!==false,includeRecent=opts.includeJanelaRecente!==false,excludeReceived=opts.excludeCumprimentoRecebido!==false;
 const out=[];
 for(const raw of cases||[]){
  const c=normalizeLexisCase(raw);
  if(isClosed(c)||String(c.situacao||'').toUpperCase()==='ARQUIVADO')continue;
  if(onlyActionable&&!stillActionable(c))continue;if(onlyActionable&&onlyCustas(c))continue;
  const phase=detectFlagsFase(c);if(excludeReceived&&phase.cumprimentoRecebido)continue;
  const latest=ultimaDataTribunal(c),daysSinceCourt=daysSince(latest.date,now);
  const live=phase.replicaPendente||phase.cumprimentoAberto||(phase.temCitacao&&!phase.temContestacao&&!phase.temSentenca)||phase.temAudiencia;
  let state;
  if(!latest.temSinalTribunal)state='sem_scan';
  else if(['datajud','djen','evento'].includes(latest.fonte))state='parado_confirmado';
  else state='parado_provavel';
  if(state==='sem_scan'){if(!includeSemScan||onlyConfirmed)continue;}
  else{const days=daysSinceCourt??0;if(days<minDays&&!(includeRecent&&live&&days<minDays))continue;}
  const daysNoReturn=daysSince(parseDateLoose(c.ultimoRetorno),now),daysForScore=state==='sem_scan'?0:daysSinceCourt??0;
  const next=opportunities(c,daysForScore,state);if(onlyActionable&&!next.length)continue;
  const f=detectFlagsFase(c);
  out.push({case:c,estado:state,diasParadoTribunal:state==='sem_scan'?0:daysSinceCourt??0,diasSemRetornoEquipe:daysNoReturn,
   fonteData:latest.fonte,dataReferencia:latest.raw,ultimoSinalResumo:latest.resumo,oportunidades:next,
   scoreAcao:scoreAction(daysForScore,daysNoReturn,c,state),temContestacao:f.temContestacao,temSentenca:f.temSentenca,
   temReplica:f.temReplica,cumprimentoRecebido:f.cumprimentoRecebido,cumprimentoAberto:f.cumprimentoAberto,replicaPendente:f.replicaPendente});
 }
 return out.sort((a,b)=>{if(a.estado==='sem_scan'&&b.estado!=='sem_scan')return 1;if(b.estado==='sem_scan'&&a.estado!=='sem_scan')return-1;return b.scoreAcao-a.scoreAcao||b.diasParadoTribunal-a.diasParadoTribunal;});
}
export function exportParadosCsv(rows){
 const headers=['Cliente','Processo','Estado','Dias sem movimento oficial','Fonte da data','Advogado','Telefone','Prioridade operacional','Tratado','Tem contestação','Tem sentença','Tem réplica','Réplica pendente','Cumprimento aberto','Cumprimento recebido','Último sinal'];
 return csv([headers,...(rows||[]).map(r=>[r.case.cliente,r.case.protocolo,r.estado,r.diasParadoTribunal,r.fonteData,r.case.advogado,r.case.telefone,r.scoreAcao,r.tratado?'sim':'não',r.temContestacao?'sim':'não',r.temSentenca?'sim':'não',r.temReplica?'sim':'não',r.replicaPendente?'sim':'não',r.cumprimentoAberto?'sim':'não',r.cumprimentoRecebido?'sim':'não',r.ultimoSinalResumo].map(excelSafeCell))]);
}
export function loadHandledParados({companyId,userId,store}={}){
 const target=store||(typeof window!=='undefined'?window.localStorage:null);if(!target||!companyId||!userId)return{};
 try{const value=JSON.parse(target.getItem('infinitum:parados:'+encodeURIComponent(companyId)+':'+encodeURIComponent(userId))||'{}');return object(value)?value:{};}catch{return{};}
}
export function saveHandledParado(cnj,{companyId,userId,store,day=new Date().toISOString().slice(0,10)}={}){
 const target=store||(typeof window!=='undefined'?window.localStorage:null);if(!target||!companyId||!userId||!clean(cnj))throw Error('Não foi possível identificar o processo, a empresa e o usuário.');
 const key='infinitum:parados:'+encodeURIComponent(companyId)+':'+encodeURIComponent(userId),values=loadHandledParados({companyId,userId,store:target});
 values[clean(cnj)]=day;target.setItem(key,JSON.stringify(values));return key;
}
export function clearHandledParado(cnj,{companyId,userId,store}={}){
 const target=store||(typeof window!=='undefined'?window.localStorage:null);if(!target||!companyId||!userId)return;
 const key='infinitum:parados:'+encodeURIComponent(companyId)+':'+encodeURIComponent(userId),values=loadHandledParados({companyId,userId,store:target});
 delete values[clean(cnj)];target.setItem(key,JSON.stringify(values));
}
