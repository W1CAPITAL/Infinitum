import {officeAuth,officeJson,safeOfficeError} from '../../../../../lib/office-server.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function missing(err,table){
 return ['42P01','PGRST205'].includes(String(err?.code||''))||
  new RegExp(table+'.*(not found|does not exist|schema cache)','i').test(String(err?.message||''));
}
export async function GET(request){
 try{
  const {user,db}=await officeAuth(request);
  const start=new Date(Date.now()-30*86400000).toISOString();
  const [office,mcp]=await Promise.all([
   db.from('office_agent_reply_events').select('owner_id,status,provider_message_id,created_at')
    .eq('owner_id',user.id).eq('status','accepted').not('provider_message_id','is',null)
    .gte('created_at',start).order('created_at',{ascending:false}).limit(1000),
   db.from('killa_mcp_send_intents').select('owner_id,client_id,status,provider_message_id,finished_at')
    .eq('owner_id',user.id).eq('status','accepted').not('provider_message_id','is',null)
    .gte('finished_at',start).order('finished_at',{ascending:false}).limit(1000)
  ]);
  if(office.error&&!missing(office.error,'office_agent_reply_events'))
   throw Object.assign(Error('Atendimentos OpenBot não puderam ser verificados.'),{status:503});
  if(mcp.error&&!missing(mcp.error,'killa_mcp_send_intents'))
   throw Object.assign(Error('Atendimentos MCP não puderam ser verificados.'),{status:503});
  const accepted=new Map(),byClient={};let openbotCount=0,mcpCount=0;
  for(const x of office.data||[]){
   if(x.owner_id!==user.id||x.status!=='accepted'||!x.provider_message_id)continue;
   if(accepted.has(x.provider_message_id))continue;
   accepted.set(x.provider_message_id,'OpenBot');openbotCount++;
  }
  for(const x of mcp.data||[]){
   if(x.owner_id!==user.id||x.status!=='accepted'||!x.provider_message_id)continue;
   if(accepted.has(x.provider_message_id))continue; // no double count
   accepted.set(x.provider_message_id,'MCP');mcpCount++;
   const client=String(x.client_id||'cliente OAuth');
   byClient[client]=(byClient[client]||0)+1;
  }
  return officeJson({ok:true,available:!office.error||!mcp.error,source:'WA.Auto receipts',
   periodDays:30,total:accepted.size,openbot:openbotCount,mcp:mcpCount,byClient,
   byOperator:[{userId:user.id,displayName:user.email||'Operador autenticado',accepted:accepted.size}],
   truncated:(office.data||[]).length>=1000||(mcp.data||[]).length>=1000,
   notice:'Somente mensagens aceitas pelo WA.Auto e com identificador do provedor. Aceite não comprova entrega ou leitura.'});
 }catch(e){return safeOfficeError(e)}
}
