import {officeAuth,safeOfficeError} from '../../../../lib/office-server.mjs';
import {remoteRelayRequest,RELAY_ORIGIN} from '../../../../lib/opencode-relay-policy.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request){
 try{
  const contentType=request.headers.get('content-type')||'';
  if(!contentType.includes('application/json'))throw Object.assign(Error('JSON obrigatório.'),{status:400});
  if(Number(request.headers.get('content-length')||0)>40000)throw Object.assign(Error('Solicitação muito grande.'),{status:400});
  const token=(request.headers.get('authorization')||'').replace(/^Bearer\\s+/i,'').trim();
  await officeAuth(request);
  const raw=await request.text();
  if(raw.length>40000)throw Object.assign(Error('Solicitação muito grande.'),{status:400});
  const value=JSON.parse(raw);
  const outbound=remoteRelayRequest(value);
  const url=RELAY_ORIGIN+outbound.path;
  const upstream=await fetch(url,{method:outbound.method,headers:{'Authorization':'Bearer '+token,'Accept':'application/json',...(outbound.body?{'Content-Type':'application/json'}:{})},body:outbound.body?JSON.stringify(outbound.body):undefined,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  const text=await upstream.text();
  if(text.length>68000)throw Error('Resposta da ponte excedeu o limite permitido.');
  let data;try{data=JSON.parse(text)}catch{throw Error('Ponte OpenCode não devolveu JSON.');}
  const status=[200,400,401,403,404,409,413,429,503].includes(upstream.status)?upstream.status:502;
  return Response.json(data,{status,headers:{'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){
  return safeOfficeError(error);
 }
}
