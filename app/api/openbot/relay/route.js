import {officeAuth,safeOfficeError} from '../../../../lib/office-server.mjs';
import {validatedPublicOrigin} from '../../../../lib/openbot-public-origin.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// This relay exists ONLY inside the 127.0.0.1 Windows build, whose local
// Node process does not have the private online AI/OAuth service credentials.
const REMOTE=validatedPublicOrigin(process.env.OPENBOT_DESKTOP_REMOTE);
const READABLE=new Set(['/api/openbot/models','/api/openbot/integrations','/api/openbot/composio',
 '/api/openbot/integrations/data','/api/openbot/crm/search','/api/openbot/mcp/settings','/api/openbot/mcp/edits']);
const WRITABLE=new Set(['/api/openbot/integrations','/api/openbot/composio','/api/openbot/integrations/oauth/start',
 '/api/openbot/mcp/settings','/api/openbot/mcp/edits','/api/superagente']);
function assertDesktopRequest(request){
 if(!REMOTE||process.env.OPENBOT_DESKTOP_REMOTE!==REMOTE)
  throw Object.assign(Error('O relay só está habilitado no aplicativo Windows.'),{status:404});
 const url=new URL(request.url);
 if(url.hostname!=='127.0.0.1'||!/^127\.0\.0\.1:\d{4,5}$/.test(url.host))
  throw Object.assign(Error('O relay exige a origem local do aplicativo.'),{status:403});
 const origin=request.headers.get('origin');
 if(origin&&origin!==url.origin)
  throw Object.assign(Error('Origem da requisição não autorizada.'),{status:403});
 const relative=url.searchParams.get('path')||'';
 if(!relative.startsWith('/api/')||relative.includes('//')||relative.includes('#')||relative.length>700)
  throw Object.assign(Error('Endereço de integração não autorizado.'),{status:400});
 const remote=new URL(relative,REMOTE);
 if(remote.origin!==REMOTE)throw Object.assign(Error('Destino não autorizado.'),{status:403});
 return remote;
}
async function proxy(request){
 try{
  const target=assertDesktopRequest(request),method=request.method;
  const allowed=method==='GET'?READABLE.has(target.pathname):method==='POST'||method==='DELETE'?WRITABLE.has(target.pathname):false;
  if(!allowed)throw Object.assign(Error('Operação não permitida pelo aplicativo.'),{status:405});
  // Require a valid CRM member before forwarding anything to the canonical HTTPS backend.
  await officeAuth(request);
  const auth=request.headers.get('authorization');
  const body=method==='GET'?undefined:await request.text();
  if(body&&body.length>12000)throw Object.assign(Error('Pedido excede o limite.'),{status:400});
  const result=await fetch(target,{method,redirect:'error',cache:'no-store',
   headers:{Authorization:auth,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
   body,signal:AbortSignal.timeout(42000)});
  const text=await result.text();
  if(text.length>70000)throw Object.assign(Error('Servidor retornou resposta grande demais.'),{status:502});
  return new Response(text,{status:result.status,
   headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return safeOfficeError(e)}
}
export const GET=proxy;
export const POST=proxy;
export const DELETE=proxy;
