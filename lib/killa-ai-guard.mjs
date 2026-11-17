// Killa AI's deterministic safety guard. Models never grant message permissions.
export const KILLA_LEVELS=Object.freeze(['basico','medio','alto','muito_alto','maximo']);
const dt=x=>{const d=new Date(x||'');return Number.isFinite(d.getTime())?d:null};
const fold=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const loc=x=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',
 year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(x)
 .filter(v=>v.type!=='literal').map(v=>[v.type,v.value]));
export function killaPermissionProfile(raw='basico'){
 const level=KILLA_LEVELS.includes(raw)?raw:'basico',i=KILLA_LEVELS.indexOf(level);
 return {level,canReadHistory:i>=1,canRequestOfficialResearch:i>=2,
  canProposeTasks:i>=3,canProposeAutomations:i>=4,canSendWithoutApproval:false,canOverridePolicy:false};
}
export function greetingForKilla({now=new Date(),history=[]}={}){
 const t=dt(now);if(!t)return '';
 const p=loc(t),day=p.year+p.month+p.day;
 const greeted=(Array.isArray(history)?history:[]).some(m=>{
  if(!m?.is_from_me)return false;
  const sent=dt(m.timestamp);if(!sent)return false;
  const d=loc(sent);if(day!==d.year+d.month+d.day)return false;
  return /^(bom dia|boa tarde|boa noite|ola[!., :]|ola pessoal)/i.test(fold(m.content||m.text||''));
 });
 return greeted?'':Number(p.hour)<12?'Bom dia!':Number(p.hour)<18?'Boa tarde!':'Boa noite!';
}
export function evaluateKillaHandoff({history=[],otherStaffMessages=[],receivedAt='',now=new Date(),staffHandoffHours=8,actorId=''}={}){
 const time=dt(now),received=dt(receivedAt),deny=reason=>({block:true,reason});
 if(!time||!received||received.getTime()>time.getTime()+300000)return deny('message_time_unverified');
 const h=Math.max(1,Math.min(48,Math.trunc(Number(staffHandoffHours)||8)));
 const cutoff=time.getTime()-h*3600000;
 const recent=m=>{const t=dt(m?.timestamp);return t&&t.getTime()>=cutoff&&t.getTime()<=time.getTime()+300000};
 if((Array.isArray(otherStaffMessages)?otherStaffMessages:[]).some(recent))return deny('another_staff_active');
 for(const m of Array.isArray(history)?history:[]){
  if(!m?.is_from_me||!recent(m))continue;
  if(dt(m.timestamp).getTime()>=received.getTime())return deny('outbound_after_inbound');
  if(m.owner_id&&String(m.owner_id)!==String(actorId)||m.sender_type==='human'||m.origin==='human')
   return deny('recent_human_staff');
  // fromMe identifies a WhatsApp session, not the human who typed.
  if(m.sender_type!=='bot'&&m.origin!=='killa_ai')return deny('author_unverified');
 }
 return {block:false,reason:'no_staff_evidence'};
}
export function validateKillaOutgoing(text){
 if(typeof text!=='string'||!text.trim()||text.length>3000)return {ok:false,reason:'length'};
 const value=fold(text.normalize('NFKC'));
 if(/\bbacklogs?\b|\b(?:stack trace|traceback|system prompt|developer message|service.role.key|api[_ -]?key|access token|bearer token|debug dump|internal audit|diagnostico interno|relatorio interno|logs? de execucao)\b/i.test(value)
  || /authorization\s*:\s*bearer\s+\S+|\b(?:sk-[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{30,})\b/i.test(text)
  || /(?:^|\n)\s*\{\s*"(?:backlog|internal|debug|logs)"\s*:/i.test(text)
  || text.includes(String.fromCharCode(96).repeat(3)))
   return {ok:false,reason:'internal_information_forbidden'};
 return {ok:true,reason:'client_text_only'};
}
