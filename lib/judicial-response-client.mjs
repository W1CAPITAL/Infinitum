// Preserve gateway status and authorization semantics, including non-JSON errors.
export function judicialFailureStatus(value){
 const status=Number(value?.status),code=value?.code;
 const message=String(value?.message||value?.error||'');
 if(code==='crm_access')return'unavailable';
 if(status===504||['upstream_timeout','index_timeout'].includes(code)||/\b504\b|timeout|tempo limite|tempo dispon[ií]vel|tempo esgotad|abort/i.test(message))return'timeout';
 if(status===429||/\b429\b|rate.limit/i.test(message))return'rate_limited_429';
 if(status===403||/\b403\b|forbidden|bloquead/i.test(message))return'blocked_403';
 return'unavailable';
}
export async function readConsultationResponse(response){
 const raw=await response.text();let body;
 try{body=JSON.parse(raw)}catch{}
 if(body&&typeof body==='object'&&!Array.isArray(body)){
  if(response.ok&&typeof body.ok==='boolean')return body;
  if(!response.ok){
   const code=body.code|| (response.status===401?'crm_access':response.status===504?'upstream_timeout':null);
   return {...body,ok:false,status:response.status,code,error:String(body.error||'Consulta indisponível (HTTP '+response.status+').')};
  }
 }
 const status=response.status;
 const code=[401,403].includes(status)?'crm_access':status===504?'upstream_timeout':'invalid_response';
 return {ok:false,status,code,error:code==='crm_access'?'Sessão sem permissão para consultar este processo.':status===504?'A fonte oficial excedeu o tempo disponível (HTTP 504). Nenhuma atualização confirmada.':'O servidor não respondeu com dados verificáveis (HTTP '+status+').'};
}
