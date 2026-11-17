// CRM page bridge. It does not have access to the WhatsApp tab itself.
(()=>{
 const CHANNEL='INFINITUM_BROWSER_TAB_BRIDGE';
 const ORIGIN='https://agentinfinitum.vercel.app';
 if(location.origin!==ORIGIN)return;
 // The popup can inject this bridge into an already-open CRM tab; keep exactly one listener.
 if(globalThis.__infinitumWhatsappBridgeReady===true){
  window.postMessage({channel:CHANNEL,direction:'ready'},ORIGIN);
  return;
 }
 globalThis.__infinitumWhatsappBridgeReady=true;
 window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==ORIGIN)return;
  const data=event.data;
  if(!data||data.channel!==CHANNEL||data.direction!=='request')return;
  if(typeof data.requestId!=='string'||data.requestId.length>80)return;
  if(!['status','observe','draft'].includes(data.type))return;
  chrome.runtime.sendMessage({
   channel:CHANNEL,type:data.type,
   text:data.type==='draft'?data.text:undefined,
   expectedTitle:data.type==='draft'?data.expectedTitle:undefined
  }).then(result=>{
   window.postMessage({channel:CHANNEL,direction:'response',requestId:data.requestId,
    result:result||{ok:false,reason:'Extensão indisponível'}},ORIGIN);
  }).catch(()=>{
   window.postMessage({channel:CHANNEL,direction:'response',requestId:data.requestId,
    result:{ok:false,reason:'A ponte local foi desconectada.'}},ORIGIN);
  });
 });
 window.postMessage({channel:CHANNEL,direction:'ready'},ORIGIN);
})();
