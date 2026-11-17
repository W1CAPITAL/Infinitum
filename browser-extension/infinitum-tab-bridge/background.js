import {BRIDGE_CHANNEL,BRIDGE_ORIGIN,GRANT_MS,validateBridgeRequest,canUseGrantedTab,sanitizeWhatsappSnapshot} from './policy.mjs';
import {inspectCurrentWhatsappTab,insertWhatsappComposerDraft} from './whatsapp-tab.js';
const GRANT_KEY='infinitum_whatsapp_tab_grant';
const AUDIT_KEY='infinitum_browser_bridge_actions';
async function auditAction(action,success){
 // OpenBot local log: no message content, name, number, JID, token or cookie.
 try{
  const state=await chrome.storage.session.get(AUDIT_KEY);
  const old=Array.isArray(state[AUDIT_KEY])?state[AUDIT_KEY]:[];
  const entry={action:String(action).slice(0,32),ok:success===true,at:Date.now()};
  await chrome.storage.session.set({[AUDIT_KEY]:[...old,entry].slice(-20)});
 }catch{}
}
const grantRead=async()=>{const state=await chrome.storage.session.get(GRANT_KEY);return state?.[GRANT_KEY]||null};
const grantWrite=async grant=>chrome.storage.session.set({[GRANT_KEY]:grant});
const grantClear=async()=>chrome.storage.session.remove(GRANT_KEY);
const isExtensionPopup=sender=>{
 try{return new URL(sender.url).origin===new URL(chrome.runtime.getURL('popup.html')).origin;}
 catch{return false;}
};
async function availableTabs(){
 const tabs=await chrome.tabs.query({url:'https://web.whatsapp.com/*'});
 return tabs.filter(t=>{try{return new URL(t.url).origin==='https://web.whatsapp.com';}catch{return false;}})
  .map(t=>({id:t.id,active:t.active===true,title:String(t.title||'WhatsApp Web').slice(0,100),url:t.url}));
}
async function announceGrantToExistingCrmTabs(){
 // A newly installed or newly authorized extension does not inject content scripts retroactively.
 // Restrict injection to the explicit CRM origin; never touch any other web page.
 const tabs=await chrome.tabs.query({url:'https://agentinfinitum.vercel.app/*'});
 await Promise.all(tabs.map(async tab=>{
  try{
   if(new URL(tab.url).origin!=='https://agentinfinitum.vercel.app'||!Number.isInteger(tab.id))return;
   await chrome.scripting.executeScript({target:{tabId:tab.id},files:['crm-bridge.js']});
  }catch{} // A closed/restricted tab can be retried by refreshing the CRM page.
 }));
}
async function getAuthorizedTab(){
 const grant=await grantRead();
 if(!grant)return null;
 let tab;
 try{tab=await chrome.tabs.get(grant.tabId)}catch{await grantClear();return null;}
 if(!canUseGrantedTab(grant,tab)){await grantClear();return null;}
 return tab;
}
async function processPopup(request){
 if(request.action==='tabs')return {ok:true,tabs:await availableTabs()};
 if(request.action==='revoke'){await grantClear();await auditAction('revoke',true);return {ok:true,authorized:false}};
 if(request.action==='grant'){
  const id=Number(request.tabId),list=await availableTabs();
  if(!Number.isInteger(id)||!list.some(t=>t.id===id))return {ok:false,reason:'Aba WhatsApp Web não encontrada. Abra a aba e tente novamente.'};
  const expiresAt=Date.now()+GRANT_MS;
  await grantWrite({tabId:id,expiresAt});
  await auditAction('grant',true);
  await announceGrantToExistingCrmTabs().catch(()=>{});
  return {ok:true,authorized:true,tabId:id,expiresAt};
 }
 if(request.action==='status'){
  const tab=await getAuthorizedTab(),grant=tab?await grantRead():null;
  const actions=await chrome.storage.session.get(AUDIT_KEY);
  return {ok:true,authorized:!!tab,tabId:tab?.id||null,expiresAt:grant?.expiresAt||null,
   recentActions:Array.isArray(actions[AUDIT_KEY])?actions[AUDIT_KEY].slice(-5):[]};
 }
 return {ok:false,reason:'Operação não autorizada.'};
}
async function processCrm(request,sender){
 let origin='';
 try{origin=new URL(sender.url||'').origin}catch{}
 if(origin!==BRIDGE_ORIGIN)return {ok:false,reason:'Origem do CRM não autorizada.'};
 const check=validateBridgeRequest(request,origin);
 if(!check.ok)return {ok:false,reason:check.reason};
 const tab=await getAuthorizedTab();
 if(request.type==='status'){
  const grant=tab?await grantRead():null;
  return {ok:true,installed:true,authorized:!!tab,tabId:tab?.id||null,
   expiresAt:grant?.expiresAt||null,mode:'local_tab_explicit'};
 }
 if(!tab)return {ok:false,reason:'Autorize a aba WhatsApp Web clicando no ícone da extensão. Nenhuma sessão foi acessada.'};
 let response;
 try{
  if(request.type==='observe'){
   const result=await chrome.scripting.executeScript({target:{tabId:tab.id},func:inspectCurrentWhatsappTab});
   const data=result?.[0]?.result;
   if(!data?.ok)return {ok:false,reason:String(data?.reason||'Aba sem conversa aberta.').slice(0,170)};
   response={ok:true,snapshot:sanitizeWhatsappSnapshot(data),warning:data.warning};
  }else if(request.type==='draft'){
   const result=await chrome.scripting.executeScript({
    target:{tabId:tab.id},func:insertWhatsappComposerDraft,args:[String(request.text).trim(),request.expectedTitle]
   });
   const data=result?.[0]?.result;
   response={ok:data?.ok===true,prepared:data?.prepared===true,submitted:false,
    reason:data?.reason||null,warning:data?.warning||null};
  }else response={ok:false,reason:'Ação não permitida'};
 }catch{
  response={ok:false,reason:'A aba não está acessível ou o WhatsApp Web mudou sua interface. Nenhuma mensagem foi enviada.'};
 }
 await auditAction(request.type,response?.ok===true);
 return response;
}
chrome.runtime.onMessage.addListener((request,sender,sendResponse)=>{
 if(request?.channel!==BRIDGE_CHANNEL)return false;
 Promise.resolve().then(async()=>{
  if(isExtensionPopup(sender))return processPopup(request);
  return processCrm(request,sender);
 }).then(data=>sendResponse(data)).catch(()=>sendResponse({ok:false,reason:'Falha local da ponte com navegador.'}));
 return true;
});
chrome.tabs.onRemoved.addListener(async tabId=>{
 try{
  const grant=await grantRead();
  if(grant?.tabId===tabId)await grantClear();
 }catch{}
});
