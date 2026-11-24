export function draftForChat(drafts,jid){return jid?String(drafts?.[jid]||''):''}
export function updateChatDraft(drafts,jid,value){if(!jid)return drafts;const next={...drafts};if(value)next[jid]=String(value).slice(0,3000);else delete next[jid];return next}
export function acceptedSendState(accepted,refreshError){return accepted?{accepted:true,retry:false,notice:refreshError?'Envio aceito pelo serviço; atualização indisponível. Não reenvie sem conferir o histórico.':'Envio aceito pelo serviço. Entrega ainda depende do WhatsApp.'}:{accepted:false,retry:false,notice:'Envio não confirmado. Confira o histórico antes de tentar novamente.'}}
export function serviceState(result,type){
 if(result?.status==='pending')return {label:'Verificando…',tone:'pending'};
 if(result?.status!=='fulfilled'||!result.value?.ok)return {label:'Consulta indisponível',tone:'unknown'};
 const value=result.value;
 if(type==='wa')return value.connected===true&&value.configured===true?{label:'Conectado',tone:'ready'}:value.configured===true?{label:'Desconectado',tone:'warning'}:{label:'Não configurado',tone:'warning'};
 if(type==='ai')return value.configured===true?{label:'Configurado · geração não testada',tone:'ready'}:{label:'IA remota não configurada',tone:'warning'};
 return {label:'Fonte consultada',tone:'ready'};
}
export function mergeHistory(rows=[],incoming=[]){const byId=new Map();for(const row of [...rows,...incoming])if(row?.id)byId.set(row.id,row);return [...byId.values()].sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id).localeCompare(String(b.id)))}
export function allowsExternalFallback(consent,fallback){return consent===true&&fallback===true}
