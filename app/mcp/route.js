import {officeAuth} from '../../lib/office-server.mjs';
import {handleKillaMcpMessage,authorizeKillaMcpSession} from '../../lib/killa-mcp.mjs';
import {killaResourceMetadata,killaMcpUnauthorized} from '../../lib/killa-mcp-oauth.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=90;
const headers={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
export async function POST(request){
 if(Number(request.headers.get('content-length')||0)>30000)return Response.json({error:'Payload MCP grande demais.'},{status:413,headers});
 const raw=await request.text();
 if(raw.length>30000)return Response.json({error:'Payload MCP grande demais.'},{status:413,headers});
 let message;try{message=JSON.parse(raw)}catch{return Response.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'JSON inválido.'}},{status:400,headers})}
 if(Array.isArray(message))return Response.json({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Requisições em lote não são aceitas.'}},{status:400,headers});
 const method=String(message?.method||'');
 // No MCP method can bypass OAuth by sending "initialize" or "tools/list".
 let ctx={};
 try{
  const auth=await officeAuth(request,{allowOAuth:true});
  await authorizeKillaMcpSession(auth);
  ctx={...auth,authorization:request.headers.get('authorization')||''};
 }catch(error){
  const status=Number(error?.status)||401;
  if(status===401)return killaMcpUnauthorized();
  const safeStatus=[403,429,503].includes(status)?status:403;
  return Response.json({error:String(error?.message||'Acesso MCP negado.').slice(0,240)},
   {status:safeStatus,headers});
 }
 // Rate controls belong on the authenticated endpoint; never trust a client-supplied owner or company.
 const result=await handleKillaMcpMessage(message,ctx);
 return result===null?new Response(null,{status:202,headers:{'Cache-Control':'no-store'}}):
  Response.json(result,{status:200,headers});
}
export function GET(){return new Response('Streamable HTTP: POST obrigatório.',{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}})}
