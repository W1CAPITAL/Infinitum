import {greetingForKilla,KILLA_LEVELS} from './killa-ai-guard.mjs';
// Company-scoped deterministic WhatsApp policy for INFINITUM/OpenBot.
// Qwen 0.5B may edit tone only; it never determines identity, judicial facts,
// private data access, permissions, message recipients or send authority.
export const DEFAULT_OPENBOT_COMPANY_POLICY=Object.freeze({
 reply_mode:'draft_only',only_private:true,groups:'ignore',
 require_process_context:true,administrative:'mention_only',
 audio_without_transcript:'status_if_authorized',bot_mentions:['@KillaAI','@OpenBot'],
 excluded_contacts:[],allowed_group_jids:[],admin_contact_terms:['administrativo','administrativa','financeiro','secretaria'],
 return_min_days:15,return_max_days:30,return_stalled_days:30,stalled_after_days:75,staff_handoff_hours:8,
 history_limit:20,lookback_hours:48,style:'cordial',
 responder_label:'Killa AI',permission_level:'basico',mcp_enabled:false,mcp_group_history_enabled:false,
 mcp_allowed_client_ids:[],learning_enabled:true
});
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/\s+/g,' ').trim();
const digits=value=>String(value??'').replace(/\D/g,'');
const privateJid=/^[1-9][0-9]{9,14}@s\.whatsapp\.net$/;
const groupJid=/^[0-9-]+@g\.us$/;
const processSignal=/processo|andamento|movimenta|tribunal|juiz|autos|audiencia|despacho|sentenca|julgamento|decisao|djen|datajud/i;
const followup=/novidade|atualiza|como esta|como ficou|alguma coisa|tem noticias|e agora|resposta|retorno/i;
const safeStyleTags=new Set(['more_cordial','more_concise','more_natural','avoid_repetition','mention_sources']);
const n=(value,min,max,def)=>{
 const x=Number(value);
 return Number.isSafeInteger(x)?Math.max(min,Math.min(max,x)):def;
};
const arr=(value,max)=>Array.isArray(value)?value.slice(0,max):[];
export function normalizeOpenBotPolicy(raw={}){
 const v={...DEFAULT_OPENBOT_COMPANY_POLICY,...(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{})};
 const min=n(v.return_min_days,7,45,15);
 const max=n(v.return_max_days,min,60,30);
 const groups=['ignore','internal_only','draft_only'].includes(v.groups)?v.groups:'ignore';
 const excluded=arr(v.excluded_contacts,200).map(x=>({
  kind:x?.kind==='phone'?'phone':x?.kind==='name'?'name':null,
  value:String(x?.value||'').trim().slice(0,90)
 })).filter(x=>x.kind&&x.value.length>=3).map(x=>({...x,value:x.kind==='phone'?digits(x.value):fold(x.value)}));
 const mcpAllowedClientIds=[...new Set(arr(v.mcp_allowed_client_ids,20)
  .map(x=>String(x||'').trim())
  .filter(x=>/^[A-Za-z0-9._:-]{5,200}$/.test(x)))];
 return {
  reply_mode:['draft_only','manual_approval'].includes(v.reply_mode)?v.reply_mode:'draft_only',
  only_private:v.only_private!==false,groups,require_process_context:v.require_process_context!==false,
  administrative:['ignore','mention_only','manual_review'].includes(v.administrative)?v.administrative:'mention_only',
  audio_without_transcript:v.audio_without_transcript==='manual_review'?'manual_review':'status_if_authorized',
  bot_mentions:arr(v.bot_mentions,10).map(x=>fold(x).slice(0,35)).filter(x=>x.startsWith('@')&&x.length>2),
  excluded_contacts:excluded,
  allowed_group_jids:arr(v.allowed_group_jids,70).map(x=>String(x)).filter(x=>groupJid.test(x)),
  admin_contact_terms:arr(v.admin_contact_terms,16).map(x=>fold(x).slice(0,45)).filter(x=>x.length>=4),
  return_min_days:min,return_max_days:max,
  return_stalled_days:n(v.return_stalled_days,min,max,Math.min(30,max)),
  stalled_after_days:n(v.stalled_after_days,30,365,75),
  history_limit:n(v.history_limit,8,40,20),lookback_hours:n(v.lookback_hours,24,168,48),
  staff_handoff_hours:n(v.staff_handoff_hours,1,48,8),
  style:['cordial','direto','acolhedor'].includes(v.style)?v.style:'cordial',
  responder_label:String(v.responder_label||'Killa AI').trim().slice(0,45)||'Killa AI',
  permission_level:KILLA_LEVELS.includes(v.permission_level)?v.permission_level:'basico',
  mcp_enabled:v.mcp_enabled===true,mcp_group_history_enabled:v.mcp_group_history_enabled===true,
  mcp_allowed_client_ids:mcpAllowedClientIds,
  learning_enabled:v.learning_enabled!==false
 };
}
export function contactNameVariants(input){
 const value=fold(input).replace(/[\[\](){}]/g,' ');
 const pieces=value.split(/\s*[/|;]\s*|\s+-\s+|\s+–\s+/);
 return [...new Set(pieces.map(x=>x.replace(/\b(financeiro|secretaria|recepcao|administrativo|administrativa|atendimento|cliente|contato|suporte|setor|advogado)\b/g,'').replace(/\s+/g,' ').trim())
  .filter(x=>x.length>=3&&x.length<=85))].sort((a,b)=>b.split(' ').length-a.split(' ').length||b.length-a.length).slice(0,6);
}
export function rankProcessCandidates({profileName='',phone='',cases=[]}={}){
 const variants=contactNameVariants(profileName),phoneDigits=digits(phone).replace(/^55(?=\d{10,11}$)/,'');
 return arr(cases,100).map(c=>{
  const client=fold(c?.cliente),clientTel=digits(c?.telefone).replace(/^55(?=\d{10,11}$)/,'');
  const byPhone=phoneDigits.length>=10&&phoneDigits===clientTel;
  const match=variants.filter(v=>v===client||(v.split(' ').length>=2&&client.includes(v)));
  const best=match.reduce((a,v)=>Math.max(a,v.split(' ').length*12+v.length),0);
  const score=byPhone?1000:best;
  return {...c,score,matchedBy:byPhone?'phone':best?'name':'none',canAutoAssociate:false,candidateOnly:true};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,12);
}
const excluded=(policy,jid,name)=>{
 const phone=digits(jid.split('@')[0]),contact=fold(name);
 return policy.excluded_contacts.some(x=>x.kind==='phone'?phone===digits(x.value):
  contact===fold(x.value)||(fold(x.value).length>=6&&contact.includes(fold(x.value))));
};
export function evaluateOpenBotInbound({
 policy=DEFAULT_OPENBOT_COMPANY_POLICY,jid='',contactName='',authorized=false,
 administrativeContact=false,staffRepliedAfter=false,otherStaffActive=false,
 isGroup=false,text='',mediaType='',history=[]
}={}){
 const p=normalizeOpenBotPolicy(policy),message=String(text||'').slice(0,3000),t=fold(message);
 const result=(decision,reason)=>({decision,reason,sendsWhatsapp:false,askForTranscription:false});
 if(!jid||(!privateJid.test(jid)&&!groupJid.test(jid)))return result('ignore','unknown_destination');
 if(excluded(p,jid,contactName))return result('ignore','excluded_contact');
 const mentioned=p.bot_mentions.some(m=>t.includes(m))&&p.bot_mentions.length>0;
 if(isGroup||groupJid.test(jid)){
  if(p.groups==='ignore'||!p.allowed_group_jids.includes(jid)||!mentioned)return result('ignore','group_not_allowed');
  return result(/tarefa|anot|advogad|d[uú]vida|consulta/i.test(t)?'task_review':'review','group_requires_human');
 }
 if(staffRepliedAfter||otherStaffActive)return result('ignore','another_staff_active');
 const isAdmin=administrativeContact||
  p.admin_contact_terms.some(w=>w.length>=4&&fold(contactName).includes(w));
 if(isAdmin&&(p.administrative==='ignore'||p.administrative==='mention_only'&&!mentioned))
  return result('ignore','administrative_contact');
 if(isAdmin&&p.administrative==='manual_review')return result('review','administrative_review');
 if(!authorized)return result('review','identity_or_process_not_verified');
 const untranscribed=/^(audio|ptt|voice|voice_note|voice-message)$/i.test(String(mediaType||''))&&
  (!t||/^\[?(audio|mensagem de voz|voice message|ptt)\]?$/i.test(t));
 if(untranscribed)
  return result(p.audio_without_transcript==='manual_review'?'review':'research','untranscribed_audio');
 const previous=arr(history,40).some(x=>processSignal.test(fold(x?.content||x?.text||'')));
 if(p.require_process_context&&!processSignal.test(t)&&!(previous&&followup.test(t)))
  return result('ignore','unrelated_to_case');
 return result('draft','authorized_process_context');
}
const asDate=value=>{const t=Date.parse(String(value||''));return Number.isFinite(t)?new Date(t):null};
const dateUtc=value=>{
 const d=asDate(value);return d?new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())):null;
};
const fmt=value=>value.toISOString().slice(0,10);
export function planNextOpenBotReturn({
 now=new Date(),policy=DEFAULT_OPENBOT_COMPANY_POLICY,movementAt='',previousReturnAt='',previousNextAt=''
}={}){
 const p=normalizeOpenBotPolicy(policy);
 const clock=now instanceof Date?now:new Date(now);
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
  timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(clock).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 const current=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)));
 const movement=dateUtc(movementAt);
 const stagnant=!movement||current.getTime()-movement.getTime()>=p.stalled_after_days*86400000;
 const histFrom=dateUtc(previousReturnAt),histTo=dateUtc(previousNextAt);
 const historic=histFrom&&histTo?Math.round((histTo-histFrom)/86400000):0;
 const defaultDays=stagnant?p.return_stalled_days:
   movement&&current.getTime()-movement.getTime()<30*86400000?p.return_min_days:
   Math.round((p.return_min_days+p.return_max_days)/2);
 const days=Math.max(p.return_min_days,Math.min(p.return_max_days,
  historic>=p.return_min_days&&historic<=p.return_max_days&&!stagnant?historic:defaultDays));
 const due=new Date(current.getTime()+days*86400000);
 return {days,dueDate:fmt(due),stalled:stagnant,reason:stagnant?'stalled_case':'active_case'};
}
export function composeOpenBotCaseReply({
 sourceText='',sourceAt='',movementAt='',lastReturnAt='',history=[],policy=DEFAULT_OPENBOT_COMPANY_POLICY,
 clientName='',learning=[],sourceLabel='DataJud',now=new Date()
}={}){
 const p=normalizeOpenBotPolicy(policy),movement=dateUtc(movementAt),lastReturn=dateUtc(lastReturnAt);
 const staleSinceContact=Boolean(movement&&lastReturn&&movement.getTime()<=lastReturn.getTime());
 const recentOutgoing=arr(history,40).some(m=>m?.is_from_me&&String(m?.content||'').trim().length>15);
 const repeatedUpdate=staleSinceContact&&recentOutgoing;
 const effective=deriveApprovedLearning(learning);
 const greeting=greetingForKilla({now,history});
 // Never infer client identity from WhatsApp display names.
 const context=repeatedUpdate?
  'Desde nosso último atendimento, não foi identificada uma nova movimentação confirmada nas informações oficiais consultadas. Continuamos acompanhando o processo.':
  String(sourceText||'').trim();
 const checkedDate=asDate(sourceAt);
 const label=['DataJud','DJEN','Agenda oficial'].includes(sourceLabel)?sourceLabel:'Fonte oficial';
 const sourceNote=effective.includes('mention_sources')&&checkedDate?
  ' Fonte: '+label+' conferida em '+checkedDate.toLocaleDateString('pt-BR',{timeZone:'UTC'})+'.':'';
 const end=effective.includes('more_concise')?'':effective.includes('more_cordial')?
  ' Permanecemos à disposição para esclarecer informações confirmadas.':' Seguimos à disposição.';
 const text=[greeting,context+sourceNote+end].filter(Boolean).join(' ');
 return {text:text.slice(0,1100),repeatedUpdate,sourceAt,requiresHumanReview:true};
}
export function deriveApprovedLearning(entries=[]){
 const counts=new Map();
 for(const e of arr(entries,50)){
  if(!e||!safeStyleTags.has(e.tag))continue;
  const approved=Number.isFinite(Number(e.approved_count))?Number(e.approved_count):
   e.approved===true?1:0;
  const rejected=Math.max(0,Math.min(20,Number(e.rejected_count)||0));
  if(approved<=rejected)continue;
  counts.set(e.tag,(counts.get(e.tag)||0)+Math.max(0,Math.min(20,approved)));
 }
 return [...counts].filter(([,n])=>n>=3).map(([tag])=>tag);
}

export function isConciliationLinkRequest(input){
 const text=fold(String(input||'').slice(0,450));
 if(!/(audiencia|conciliacao)/.test(text))return false;
 if(!/(link|acesso|entrar|participar|reuniao|quando|horario|data|onde)/.test(text))return false;
 if(/\b(recurso|sentenca|liminar|prazo|cancelamento|remarcacao|acordo|valores?|pagamento|quanto|receber|indenizacao|penhora|bloqueio)\b/.test(text))
  return false;
 return true;
}
