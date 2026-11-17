const API_ORIGIN='https://backend.composio.dev';
export const COMPOSIO_TOOLKITS=Object.freeze(['instagram','whatsapp']);
const MAX_BODY=12000;

function apiKey(env=process.env){
 const value=String(env.COMPOSIO_API_KEY||'').trim();
 if(!value)throw Object.assign(Error('Composio não configurado no servidor Vercel. Cadastre COMPOSIO_API_KEY.'),{status:503});
 if(!/^ak_[A-Za-z0-9_-]{12,200}$/.test(value))
  throw Object.assign(Error('A chave Composio cadastrada no servidor tem formato inválido.'),{status:503});
 return value;
}
export function composioConfigured(env=process.env){return /^ak_[A-Za-z0-9_-]{12,200}$/.test(String(env.COMPOSIO_API_KEY||'').trim())}

async function composioRequest(path,{method='GET',body,version='v3'}={}){
 const key=apiKey();
 if(typeof path!=='string'||!path.startsWith('/')||path.includes('..')||path.includes('//'))
  throw Object.assign(Error('Rota Composio inválida.'),{status:400});
 const url=API_ORIGIN+'/api/'+version+path;
 const payload=body===undefined?undefined:JSON.stringify(body);
 if(payload&&payload.length>MAX_BODY)throw Object.assign(Error('Pedido Composio excedeu o limite.'),{status:400});
 let response;
 try{
  response=await fetch(url,{method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(18000),
   headers:{'x-api-key':key,Accept:'application/json',...(payload?{'Content-Type':'application/json'}:{})},
   body:payload});
 }catch(error){
  throw Object.assign(Error('Composio indisponível no momento. Verifique a conexão do servidor Vercel.'),{status:502});
 }
 const raw=await response.text();
 if(raw.length>65000)throw Object.assign(Error('Resposta Composio excedeu o limite.'),{status:502});
 let data={};
 if(raw){try{data=JSON.parse(raw)}catch{throw Object.assign(Error('Composio retornou uma resposta inválida.'),{status:502})}}
 if(!response.ok){
  const message=String(data.message||data.error?.message||data.error||'Operação recusada pelo Composio.').slice(0,180);
  const status=[400,401,402,403,404,409,410,413,422,429].includes(response.status)?response.status:502;
  throw Object.assign(Error('Composio: '+message),{status});
 }
 return data;
}

export async function createComposioSession(userId){
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(userId||'')))
  throw Object.assign(Error('Usuário do INFINITUM inválido para o Composio.'),{status:400});
 return composioRequest('/tool_router/session',{method:'POST',body:{
  user_id:userId,
  toolkits:{enabled:[...COMPOSIO_TOOLKITS]},
  manage_connections:{enabled:true,enable_wait_for_connections:false,enable_connection_removal:true},
  multi_account:{enable:true,max_accounts_per_toolkit:10,require_explicit_selection:true},
  tags:{require_approval:['createHint','updateHint','destructiveHint']},
  experimental:{no_elicitation_support_fallback:'deny'}
 }});
}

export async function getOrCreateComposioSession(userId,admin){
 if(!admin)throw Object.assign(Error('Armazenamento seguro do Composio não está disponível.'),{status:503});
 const saved=await admin.from('openbot_composio_sessions').select('session_id').eq('owner_id',userId).maybeSingle();
 if(saved.error)throw Object.assign(Error('Não foi possível recuperar a sessão remota do Composio.'),{status:503});
 if(saved.data?.session_id){
  try{
   await composioRequest('/tool_router/session/'+encodeURIComponent(saved.data.session_id));
   return {session_id:saved.data.session_id};
  }catch(error){if(error.status!==404)throw error}
 }
 const created=await createComposioSession(userId);
 if(!created.session_id)throw Object.assign(Error('Composio não criou uma sessão.'),{status:502});
 const write=await admin.from('openbot_composio_sessions').upsert({
  owner_id:userId,session_id:created.session_id,updated_at:new Date().toISOString()
 },{onConflict:'owner_id'}).select('session_id').single();
 if(write.error||!write.data)throw Object.assign(Error('Não foi possível registrar a sessão remota no Supabase.'),{status:503});
 return {session_id:write.data.session_id};
}

export async function listComposioToolkits(userId,admin){
 const session=await getOrCreateComposioSession(userId,admin);
 const query=new URLSearchParams({toolkits:COMPOSIO_TOOLKITS.join(','),limit:'50'});
 const result=await composioRequest('/tool_router/session/'+encodeURIComponent(session.session_id)+'/toolkits?'+query);
 return (result.items||[]).map(item=>{
  const account=item.connected_account||item.connection?.connected_account||null;
  return {toolkit:String(item.slug||''),name:String(item.name||item.slug||'Aplicativo'),
   connected:!!account&&String(account.status||'').toUpperCase()==='ACTIVE',
   status:String(account?.status||'NOT_CONNECTED').toUpperCase(),
   connectedAccountId:account?.id?String(account.id):'',
   alias:String(account?.state?.val?.displayName||account?.state?.val?.username||''),
   createdAt:account?.created_at||null};
 }).filter(item=>COMPOSIO_TOOLKITS.includes(item.toolkit));
}

export async function startComposioConnection(userId,toolkit,callbackUrl,alias,admin){
 if(!COMPOSIO_TOOLKITS.includes(toolkit))throw Object.assign(Error('Aplicativo Composio não permitido.'),{status:400});
 const session=await getOrCreateComposioSession(userId,admin);
 const link=await composioRequest('/tool_router/session/'+encodeURIComponent(session.session_id)+'/link',{
  method:'POST',body:{toolkit,callback_url:callbackUrl,alias:String(alias||'').slice(0,120)}
 });
 let redirect;
 try{redirect=new URL(String(link.redirect_url||''))}catch{redirect=null}
 if(!redirect||redirect.protocol!=='https:'||!['app.composio.dev','connect.composio.dev'].includes(redirect.hostname)
  ||!redirect.pathname.startsWith('/link/'))
  throw Object.assign(Error('Composio não retornou um link seguro de autorização.'),{status:502});
 return {redirectUrl:link.redirect_url,connectedAccountId:String(link.connected_account_id||'')};
}

export async function searchComposioTools(userId,query,admin){
 const text=String(query||'').trim().slice(0,240);
 if(text.length<3)throw Object.assign(Error('Descreva a ação com pelo menos três caracteres.'),{status:400});
 const session=await getOrCreateComposioSession(userId,admin);
 const result=await composioRequest('/tool_router/session/'+encodeURIComponent(session.session_id)+'/search',{
  method:'POST',body:{queries:[{use_case:text}],search_strategy:'tool_search'}
 });
 const schemas=result.tool_schemas||{};
 const safeSchemas=Object.fromEntries(Object.entries(schemas).filter(([slug,item])=>
  /^(INSTAGRAM|WHATSAPP)_/.test(slug)&&COMPOSIO_TOOLKITS.includes(String(item.toolkit||'').toLowerCase())));
 return {success:result.success!==false,results:(result.results||[]).map(x=>({
  use_case:x.use_case,primary_tool_slugs:(x.primary_tool_slugs||[]).filter(s=>/^(INSTAGRAM|WHATSAPP)_/.test(s)),
  related_tool_slugs:(x.related_tool_slugs||[]).filter(s=>/^(INSTAGRAM|WHATSAPP)_/.test(s)),
  execution_guidance:String(x.execution_guidance||'').slice(0,1800),
  known_pitfalls:(x.known_pitfalls||[]).slice(0,8)
 })),tool_schemas:safeSchemas};
}

export function isComposioWriteTool(slug){
 return /(?:^|_)(?:SEND|POST|PUBLISH|CREATE|UPDATE|DELETE|REMOVE|REPLY|COMMENT|UPLOAD|FOLLOW|UNFOLLOW|BLOCK|APPROVE|ARCHIVE|MARK|MUTE|UNMUTE|STORY|MESSAGE)(?:_|$)/i.test(String(slug||''));
}

export async function executeComposioTool(userId,toolSlug,args={},options={},admin){
 const slug=String(toolSlug||'').trim().toUpperCase();
 if(!/^(INSTAGRAM|WHATSAPP)_[A-Z0-9_]{3,150}$/.test(slug))
  throw Object.assign(Error('Ação fora dos aplicativos Instagram e WhatsApp.'),{status:403});
 if(!args||typeof args!=='object'||Array.isArray(args))
  throw Object.assign(Error('Parâmetros da ação inválidos.'),{status:400});
 const session=await getOrCreateComposioSession(userId,admin);
 const body={tool_slug:slug,arguments:args};
 if(typeof options.account==='string'&&options.account.length<200)body.account=options.account;
 if(options.inputResponses&&typeof options.inputResponses==='object')body.input_responses=options.inputResponses;
 if(typeof options.requestState==='string'&&options.requestState.length<12000)body.request_state=options.requestState;
 return composioRequest('/tool_router/session/'+encodeURIComponent(session.session_id)+'/execute',{method:'POST',body});
}

export async function deleteComposioAccount(userId,connectedAccountId,admin){
 const id=String(connectedAccountId||'');
 if(!/^ca_[A-Za-z0-9_-]{6,180}$/.test(id))
  throw Object.assign(Error('ID da conta Composio inválido.'),{status:400});
 const accounts=await listComposioToolkits(userId,admin);
 const owned=accounts.some(item=>item.connectedAccountId===id&&item.connected);
 if(!owned)throw Object.assign(Error('Esta conta não pertence ao usuário autenticado do INFINITUM.'),{status:404});
 await composioRequest('/connected_accounts/'+encodeURIComponent(id)+'?revoke_on_delete=true',{
  method:'DELETE',version:'v3.1'
 });
 return {removed:true,connectedAccountId:id};
}
