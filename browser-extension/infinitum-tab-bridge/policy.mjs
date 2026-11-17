// Only the user's permanent, logged-in INFINITUM website may communicate
// with this user-installed Chrome extension. No remote debugger or backend.
export const BRIDGE_ORIGIN='https://agentinfinitum.vercel.app';
export const BRIDGE_CHANNEL='INFINITUM_BROWSER_TAB_BRIDGE';
export const GRANT_MS=60*60*1000;
const allowedTypes=new Set(['status','observe','draft']);
export function validateBridgeRequest(input,origin){
 if(origin!==BRIDGE_ORIGIN||!input||!allowedTypes.has(input.type))
  return {ok:false,reason:'origin_or_operation_not_allowed'};
 if(input.type==='draft'){
  const text=input.text;
  if(typeof text!=='string'||text.trim().length<1||text.length>3000)
   return {ok:false,reason:'draft_out_of_bounds'};
  if(typeof input.expectedTitle!=='string'||!input.expectedTitle.trim()||input.expectedTitle.length>120)
   return {ok:false,reason:'chat_title_required'};
 }
 return {ok:true,type:input.type};
}
export function canUseGrantedTab(grant,tab,now=Date.now()){
 if(!grant||!tab||!Number.isInteger(grant.tabId)||!Number.isInteger(tab.id)||
    grant.tabId!==tab.id||!Number.isFinite(grant.expiresAt)||grant.expiresAt<=now)return false;
 try{return new URL(tab.url).origin==='https://web.whatsapp.com';}
 catch{return false;}
}
const clean=(value,max)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
export function sanitizeWhatsappSnapshot(input){
 const messages=(Array.isArray(input?.messages)?input.messages:[]).slice(-8)
  .map(m=>({text:clean(m?.text,260),direction:m?.direction==='out'?'out':'in'}))
  .filter(m=>m.text);
 return {
  title:clean(input?.title,120),
  messages,
  inspectedAt:Date.now(),
  identityVerified:false,
  officialProcessVerified:false,
  sendsWhatsapp:false
 };
}
