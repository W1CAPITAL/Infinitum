// Subscribe only to owner-scoped archive/receipt tables with RLS SELECT.
 // Do not subscribe to the entire tenant, global business tables, or DELETE events.
export const OWNER_REALTIME_TABLES=Object.freeze([
 'office_wa_chat_archive',
 'office_wa_message_archive',
 'killa_mcp_send_intents'
]);
export function subscribeKillaRealtime(db,userId,onChange){
 if(!db||typeof db.channel!=='function'||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(userId||''))||typeof onChange!=='function')
  return ()=>{};
 const channel=db.channel('killa-owner-events-'+userId.slice(0,8));
 for(const table of OWNER_REALTIME_TABLES){
  channel.on('postgres_changes',{
   schema:'public',table,event:'*',filter:'owner_id=eq.'+userId
  },payload=>{
   if(payload.eventType!=='INSERT'&&payload.eventType!=='UPDATE')return;
   // Never expose message bodies, tokens, or rows to cross-component listeners.
   onChange({table,eventType:payload.eventType});
  });
 }
 channel.subscribe();
 let closed=false;
 return ()=>{
  if(closed)return;
  closed=true;
  // Supabase Realtime actively stops the socket and unsubscribes on logout/user switch.
  Promise.resolve(db.removeChannel(channel)).catch(()=>{});
 };
}
