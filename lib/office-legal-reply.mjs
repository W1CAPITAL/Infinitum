// Safe, deterministic core for INFINITUM's legal inbound-response workflow.
// Skills from Agent Reach, Anthropic and LexisPredict only guide read-only
// research / writing; user-supplied content must never become tool instructions.
const direct=/^[1-9][0-9]{9,14}@s\.whatsapp\.net$/;
const sensitive=/honor[aá]ri|pagamento|boleto|pix\b|saque|saldo|dinheiro|contrato|proposta|acordo|desist|cobran[cç]a|reembolso|bloqueio|desbloqueio|aposentadoria|senten[cç]a|recurso|audi[eê]ncia|liminar|ganh|perd|proced[eê]n|improced[eê]n|prazo|indeniza[cç][aã]o|intima[cç][aã]o|advogado|reclama[cç][aã]o|documentos pessoais|cpf|sigilo|banco/i;
const dangerous=/ignore (as |essas |suas )?regras|desconsidere|finja que|system prompt|developer message|dispare|envie (a |para )?todos|lista de contatos|mass[ao]|70 contatos|outras pessoas|outros clientes|segredo|api.key|service.role|token|senha/i;
const processQuestion=/processo|andamento|movimenta[cç][aã]o|consulta judicial|tribunal|datajud|djen|not[ií]cia do caso|fase (da |do )?a[cç][aã]o/i;
const fmt=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?
 new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(d):null};
export function routeInboundQuestion(input,{jid,fromMe=false}={}){
 if(fromMe||!direct.test(String(jid||'')))return 'ignore';
 const text=String(input||'').slice(0,1800).trim();
 if(text.length<5||dangerous.test(text))return 'ignore';
 if(sensitive.test(text))return 'human_review';
 return processQuestion.test(text)?'process':'ignore';
}
export function buildVerifiedReply({caseRow,now=new Date()}={}){
 const no=reason=>({ok:false,reason,source:null,text:null});
 if(!caseRow||caseRow.datajud_last_ok!==true)return no('source_not_confirmed');
 const checked=Date.parse(caseRow.datajud_consultado_em||'');
 if(!Number.isFinite(checked)||checked>now.getTime()+5*60000||now.getTime()-checked>7*86400000)
  return no('source_stale');
 const title=String(caseRow.datajud_ultimo_nome||'').trim().slice(0,250);
 const movementAt=Date.parse(caseRow.datajud_ultimo_movimento||''),date=fmt(caseRow.datajud_ultimo_movimento);
 if(!title||!Number.isFinite(movementAt)||movementAt>checked+5*60000||!date)return no('movement_unverified');
 if(sensitive.test(title))return no('movement_complex');
 let meaning='';
 if(/conclus[oa]s?\s+para\s+(?:decis[aã]o|despacho)/i.test(title))
  meaning='o processo foi encaminhado ao juiz para análise';
 else if(/juntada\s+de\s+(?:peti[cç][aã]o|documento|documentos)/i.test(title))
  meaning='um documento foi incluído no processo';
 else if(/distribui[cç][aã]o\s+do\s+processo|processo\s+distribu[ií]do/i.test(title))
  meaning='o processo foi registrado e encaminhado para tramitação';
 if(!meaning)return no('movement_requires_review');
 return {ok:true,source:'DataJud',sourceAt:new Date(checked).toISOString(),
  text:'Na última consulta confirmada ao DataJud, consta que, em '+date+', '+meaning+
  '. Isso ainda não confirma uma decisão ou pagamento. Se houver uma nova movimentação, informaremos após conferência.',
  movementDate:date,requiresHumanReview:false};
}
export function prepareConversationMemory(rows=[],jid){
 const selected=(Array.isArray(rows)?rows:[]).filter(x=>x?.jid===jid&&typeof x.content==='string'&&x.content.trim());
 // The caller queries only the current authenticated operator's 8 latest records.
 return selected.slice(-8).map(x=>({
  role:x.is_from_me?'escritorio':'cliente',
  text:x.content.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,240),
  timestamp:typeof x.timestamp==='string'?x.timestamp.slice(0,35):null
 }));
}
export function validateReplyTarget({jid,approvedJid}={}){
 if(typeof jid!=='string'||jid!==approvedJid||!direct.test(jid))return null;
 return jid.split('@')[0];
}
export function canReleaseLegalReply({
 now=new Date(),privateJid,inbound=false,authorized=false,official=false,alreadySent=false,
 humanAlreadyReplied=false,globalDailyCount=0,contactDailyCount=0,lastOutboundAt=null
}={}){
 const deny=reason=>({ok:false,reason});
 if(!direct.test(String(privateJid||''))||!inbound||!authorized||!official||alreadySent||humanAlreadyReplied)
  return deny('authorization_or_evidence_missing');
 const local=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short',hour:'2-digit',
  minute:'2-digit',hour12:false}).formatToParts(now);
 const map=Object.fromEntries(local.map(x=>[x.type,x.value]));
 const hh=Number(map.hour),mm=Number(map.minute);
 if(['Sat','Sun'].includes(map.weekday)||hh<9||hh>=17||!Number.isFinite(mm))return deny('outside_service_window');
 if(Number(globalDailyCount)>=10||Number(contactDailyCount)>=1)return deny('daily_volume_limit');
 const last=lastOutboundAt?Date.parse(lastOutboundAt):NaN;
 if(Number.isFinite(last)&&now.getTime()-last<20*60*1000)return deny('global_cooldown');
 return {ok:true,reason:'private_authorized_inbound_and_verified_movement'};
}
