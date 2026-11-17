import {officeAuth,safeOfficeError} from '../../../../lib/office-server.mjs';
import {readConnectedData} from '../integrations/data/route.js';
import {validateEditProposal} from '../../../../lib/openbot-mcp-edit-policy.mjs';
import {adminClient,publicOAuthOrigin} from '../../../../lib/openbot-connection-server.mjs';
import {listComposioToolkits,searchComposioTools,executeComposioTool,isComposioWriteTool} from '../../../../lib/openbot-composio.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';

// NEXT_PUBLIC_SITE_URL provides the canonical OAuth/MCP resource origin.
const metadataUrl=()=>publicOAuthOrigin()+'/.well-known/oauth-protected-resource/api/openbot/mcp';
const resp=(id,result)=>Response.json({jsonrpc:'2.0',id,result},{headers:{
 'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'}});
const err=(id,code,message,status=200)=>Response.json({jsonrpc:'2.0',id,error:{code,message}},{status,headers:{
 'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'}});
const unauthorized=()=>{
 let metadata;
 try{metadata=metadataUrl()}catch{
  return Response.json({error:'Origem HTTPS oficial do MCP não configurada.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
 return Response.json({error:'Faça login e autorize um cliente OAuth no OpenBot.'},{
  status:401,headers:{'WWW-Authenticate':'Bearer resource_metadata="'+metadata+'"','Cache-Control':'no-store'}});
};
const bad=(message,status=403)=>Object.assign(Error(message),{status});
const norm=text=>String(text||'').replace(/[^\p{L}\p{N} .-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,80);
const toContent=value=>({content:[{type:'text',text:JSON.stringify(value)}],isError:false});
const toolsList=[
 {name:'crm_search_clients',description:'Pesquisa clientes aos quais o usuário autenticado tem acesso no INFINITUM, em modo somente leitura.',
  inputSchema:{type:'object',properties:{query:{type:'string',minLength:3,maxLength:80}},required:['query'],additionalProperties:false}},
 {name:'crm_search_processes',description:'Localiza processos autorizados do CRM pelo número ou título, sem consultar tribunais em tempo real.',
  inputSchema:{type:'object',properties:{query:{type:'string',minLength:3,maxLength:80}},required:['query'],additionalProperties:false}},
 {name:'composio_search_tools',description:'Pesquisa ações disponíveis nos plugins Instagram e WhatsApp Business conectados pelo Composio. Retorna nomes e esquemas das ferramentas; não executa nenhuma ação.',
  inputSchema:{type:'object',properties:{query:{type:'string',minLength:3,maxLength:240}},required:['query'],additionalProperties:false}},
 {name:'composio_execute_tool',description:'Executa uma ferramenta Instagram ou WhatsApp Business pelo Composio. Ações de escrita só são aceitas quando o cliente tem edição supervisionada e o Composio exige confirmação; se o cliente MCP não suportar aprovação, a ação é negada.',
  inputSchema:{type:'object',properties:{
   tool_slug:{type:'string',pattern:'^(INSTAGRAM|WHATSAPP)_[A-Z0-9_]{3,150}$'},
   arguments:{type:'object',additionalProperties:true},
   account:{type:'string',maxLength:200,description:'ID ca_... da conta conectada; obrigatório quando houver várias contas.'}
  },required:['tool_slug','arguments'],additionalProperties:false}},
 {name:'openbot_connections_status',description:'Lista provedores já autorizados no OpenBot, apenas metadados, nunca tokens.',
  inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'crm_propose_edit',description:'PROPOR uma edição supervisionada no CRM. Não altera dados até o operador revisar e aprovar com MFA no OpenBot. Apenas notas, retornos, responsáveis e prioridades.',
  inputSchema:{type:'object',properties:{
   target_table:{type:'string',enum:['office_clients','office_cases','office_deadlines','crm_clients']},
   target_id:{type:'string',format:'uuid'},field_name:{type:'string'},
   new_value:{type:'string',minLength:1,maxLength:2400},
   reason:{type:'string',minLength:12,maxLength:480}
  },required:['target_table','target_id','field_name','new_value','reason'],additionalProperties:false}},
 {name:'crm_pending_edits',description:'Consulta estado das propostas de edição do próprio usuário, sem aplicar nenhuma.',
  inputSchema:{type:'object',properties:{},additionalProperties:false}},
 ...[['drive','Drive: lista arquivos'],['sheets','Sheets: lista planilhas'],
 ['gmail','Gmail: lista marcadores'],['instagram','Instagram: lista contas profissionais']]
 .map(([service,label])=>({
  name:'openbot_'+service+'_list',description:'Consulta somente leitura. '+label+' de uma conta OAuth previamente autorizada.',
  inputSchema:{type:'object',properties:{connection_id:{type:'string',description:'ID da conexão devolvido por openbot_connections_status'}},
   required:['connection_id'],additionalProperties:false}
 }))
];
async function authorize(request){
 const {db,user,claims}=await officeAuth(request,{allowOAuth:true});
 const clientId=claims.client_id;
 if(!/^[a-zA-Z0-9._:-]{5,200}$/.test(clientId||''))throw bad('Cliente OAuth inválido.');
 const result=await db.from('openbot_mcp_grants').select('id,enabled,expires_at,edit_scope')
  .eq('owner_id',user.id).eq('client_id',clientId).eq('enabled',true)
  .gt('expires_at',new Date().toISOString()).maybeSingle();
 if(result.error||!result.data)throw bad('MausBot não foi autorizado neste CRM ou a permissão expirou.');
 return {db,user,clientId,edit_scope:result.data.edit_scope||'read'};
}
async function findClients({db,user},query){
 const q=norm(query);if(q.length<3)throw bad('A pesquisa precisa de três caracteres.',400);
 const company=await db.from('usuarios').select('empresa_id').eq('auth_user_id',user.id).limit(2);
 const empresa=company.error||company.data?.length!==1?null:company.data[0]?.empresa_id;
 const filter='%'+q+'%';
 const sources=[db.from('office_clients').select('id,name,status,next_return').eq('owner_id',user.id)
   .ilike('name',filter).limit(12)];
 if(empresa)sources.push(db.from('crm_clients').select('id,name,stage,next_return')
  .eq('empresa_id',empresa).ilike('name',filter).limit(12));
 const result=await Promise.allSettled(sources);
 return {query:q,sources:result.map((x,i)=>x.status==='fulfilled'&&!x.value.error?
  {source:i?'crm_clients':'office_clients',records:(x.value.data||[]).slice(0,12)}:
  {source:i?'crm_clients':'office_clients',error:'Sem autorização ou fonte indisponível'}),
  readOnly:true,asOf:new Date().toISOString()};
}
async function findProcesses({db,user},query){
 const q=norm(query);if(q.length<3)throw bad('A pesquisa precisa de três caracteres.',400);
 const company=await db.from('usuarios').select('empresa_id').eq('auth_user_id',user.id).limit(2);
 const empresa=company.error||company.data?.length!==1?null:company.data[0]?.empresa_id;
 const filter='%'+q+'%';
 const sources=[db.from('office_cases').select('id,title,process_number,status,tribunal')
  .eq('owner_id',user.id).ilike('process_number',filter).limit(12)];
 if(empresa)sources.push(db.from('crm_processes').select('id,process_number,process_type,client_id')
  .eq('empresa_id',empresa).ilike('process_number',filter).limit(12));
 const result=await Promise.allSettled(sources);
 return {query:q,sources:result.map((x,i)=>x.status==='fulfilled'&&!x.value.error?
  {source:i?'crm_processes':'office_cases',records:(x.value.data||[]).slice(0,12)}:
  {source:i?'crm_processes':'office_cases',error:'Sem autorização ou fonte indisponível'}),
  judicialLookupPerformed:false,asOf:new Date().toISOString()};
}
async function proposeEdit(ctx,args){
 if(ctx.edit_scope!=='reviewed_edit')throw bad('O cliente OAuth só tem leitura. Habilite Edição supervisionada no OpenBot, com MFA.',403);
 const p=validateEditProposal(args);
 const memberships=await ctx.db.from('usuarios').select('empresa_id').eq('auth_user_id',ctx.user.id).limit(2);
 if(memberships.error||memberships.data?.length!==1||!memberships.data[0].empresa_id)
  throw bad('Empresa vinculada não confirmada.',403);
 const empresa=memberships.data[0].empresa_id;
 let query=ctx.db.from(p.target_table).select('id,updated_at,'+p.field_name)
  .eq('id',p.target_id).eq('empresa_id',empresa);
 if(p.target_table!=='crm_clients')query=query.eq('owner_id',ctx.user.id);
 const record=await query.maybeSingle();
 if(record.error||!record.data)throw bad('Registro inexistente ou sem acesso para edição.',403);
 const proposal=await ctx.db.from('openbot_mcp_edit_requests').insert({
  owner_id:ctx.user.id,empresa_id:empresa,client_id:ctx.clientId,target_table:p.target_table,
  target_id:p.target_id,field_name:p.field_name,new_value:p.new_value,reason:p.reason,
  expected_updated_at:record.data.updated_at
 }).select('id,target_table,target_id,field_name,new_value,reason,status,expires_at').single();
 if(proposal.error||!proposal.data)throw bad('Não foi possível criar a proposta: '+(proposal.error?.message||'erro de acesso'),503);
 return {proposal:proposal.data,applied:false,approvalRequired:true,
  reviewUrl:publicOAuthOrigin()+'/openbot?integrations=mcp',
  notice:'Aguardando confirmação humana com MFA. Nenhum registro foi alterado.'};
}
async function pendingEdits(ctx){
 const r=await ctx.db.from('openbot_mcp_edit_requests')
  .select('id,target_table,target_id,field_name,new_value,reason,status,expires_at,created_at,reviewed_at')
  .eq('owner_id',ctx.user.id).order('created_at',{ascending:false}).limit(30);
 if(r.error)throw bad('Não foi possível consultar propostas.',503);
 return {proposals:r.data||[],editScope:ctx.edit_scope};
}
async function callTool(ctx,name,args){
 if(name==='composio_search_tools'){
  return toContent(await searchComposioTools(ctx.user.id,args.query,adminClient()));
 }
 if(name==='composio_execute_tool'){
  const slug=String(args.tool_slug||'').toUpperCase();
  if(!/^(INSTAGRAM|WHATSAPP)_[A-Z0-9_]{3,150}$/.test(slug))throw bad('Ação fora dos plugins Instagram e WhatsApp Business.',403);
  if(isComposioWriteTool(slug)&&ctx.edit_scope!=='reviewed_edit')
   throw bad('Ação de escrita bloqueada. Habilite edição supervisionada para este cliente MCP; o Composio ainda exigirá aprovação.',403);
  const result=await executeComposioTool(ctx.user.id,slug,args.arguments||{},{account:args.account||''},adminClient());
  return toContent({result,writeApproval:'As ações de escrita exigem aprovação do Composio. Se o cliente MCP não oferecer confirmação interativa, a execução será negada.',noCredentialsReturned:true});
 }
 if(name==='crm_propose_edit')return toContent(await proposeEdit(ctx,args));
 if(name==='crm_pending_edits')return toContent(await pendingEdits(ctx));

 const serviceMap={openbot_drive_list:'drive',openbot_sheets_list:'sheets',
  openbot_gmail_list:'gmail',openbot_instagram_list:'instagram'};
 if(Object.hasOwn(serviceMap,name)){
  const id=String(args?.connection_id||'');
  if(!/^[0-9a-f-]{36}$/i.test(id))throw bad('Identificador de conta OAuth inválido.',400);
  const result=await readConnectedData(ctx.user.id,serviceMap[name],id);
  return toContent(result);
 }
 if(name==='crm_search_clients')return toContent(await findClients(ctx,args.query));
 if(name==='crm_search_processes')return toContent(await findProcesses(ctx,args.query));
 if(name==='openbot_connections_status'){
  const r=await ctx.db.from('openbot_connections').select('provider,display_name,email,status,last_checked_at')
   .eq('owner_id',ctx.user.id).limit(30);
  if(r.error)throw bad('Conexões indisponíveis.',503);
  const composio=await listComposioToolkits(ctx.user.id,adminClient()).catch(()=>[]);
  return toContent({accounts:r.data||[],composioAccounts:composio,noSecrets:true,noAutomaticActions:true});
 }
 throw bad('Ferramenta não encontrada.',404);
}
export async function POST(request){
 let rpc=null;
 try{
  const length=Number(request.headers.get('content-length')||0);
  if(length>12000)return err(null,-32600,'Pedido MCP excedeu o limite.',413);
  rpc=await request.json();
  if(!rpc||rpc.jsonrpc!=='2.0'||typeof rpc.method!=='string')return err(rpc?.id??null,-32600,'JSON-RPC inválido.',400);
  const ctx=await authorize(request);
  if(rpc.method==='notifications/initialized')return new Response(null,{status:202});
  if(rpc.method==='initialize'){
   const requested=String(rpc.params?.protocolVersion||'2025-06-18');
   const version=['2025-06-18','2025-03-26','2024-11-05'].includes(requested)?requested:'2025-06-18';
   return resp(rpc.id,{protocolVersion:version,capabilities:{tools:{listChanged:false}},
    serverInfo:{name:'W1 OpenBot MCP',version:'1.0.0'}});
  }
  if(rpc.method==='ping')return resp(rpc.id,{});
  if(rpc.method==='tools/list')return resp(rpc.id,{tools:toolsList});
  if(rpc.method==='tools/call'){
   const name=rpc.params?.name, args=rpc.params?.arguments||{};
   if(!toolsList.some(t=>t.name===name))return err(rpc.id,-32601,'Ferramenta desconhecida.');
   if((name==='crm_search_clients'||name==='crm_search_processes')&&norm(args.query).length<3)
    return err(rpc.id,-32602,'Informe pelo menos três caracteres.');
   return resp(rpc.id,await callTool(ctx,name,args));
  }
  return err(rpc.id,-32601,'Método MCP não suportado.');
 }catch(e){
  if(e.status===401||!request.headers.get('authorization'))return unauthorized();
  if(e.status===403)return Response.json({error:'Cliente MCP sem autorização ativa.'},{status:403,
   headers:{'Cache-Control':'no-store','WWW-Authenticate':'Bearer resource_metadata="'+metadataUrl()+'"'}});
  console.error('openbot-mcp-call',String(e?.message||e).slice(0,80));
  return err(rpc?.id??null,-32000,'Operação MCP não concluída.',500);
 }
}
export async function GET(request){
 if(!request.headers.get('authorization'))return unauthorized();
 try{await authorize(request);return new Response(null,{status:405,headers:{Allow:'POST, OPTIONS'}})}
 catch{return unauthorized()}
}
export function OPTIONS(){
 return new Response(null,{status:204,headers:{Allow:'POST, GET, OPTIONS','Access-Control-Allow-Methods':'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers':'Authorization, Content-Type, Accept, Mcp-Protocol-Version'}});
}
