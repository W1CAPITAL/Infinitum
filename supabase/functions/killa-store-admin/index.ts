import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.95.3';
import {createMcpHandler,McpServer} from 'npm:@modelcontextprotocol/server@^2.0.0';
import {withOAuthProtectedResource} from 'npm:@supabase/server@1';
import {pipeline} from 'npm:@supabase/middleware@1';
import {z} from 'npm:zod@^4.3.6';

// Separate service from WhatsApp and the desktop: a failed store admin request
// must NEVER gain access to WA.Auto sessions or tenant message archives.
const PROJECT='ProjectW1SC/INFINITUM';
const GH_API='https://api.github.com/repos/'+PROJECT;
const ALLOWED_WORKFLOWS=['ci.yml','killa-desktop-windows.yml','killa-desktop-free-release.yml'];
const VALID_VERSION=/^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/;
const LIMIT=400000;const error=(code,status=403)=>Response.json({ok:false,error:code},{status});
const secret=(name)=>Deno.env.get(name)||'';
const escapeValue=(s,n=95)=>String(s??'').replace(/[^a-zA-Z0-9À-ž _./:()#+-]/g,' ').slice(0,n);
function claims(token){
 try{
  const segment=token.split('.')[1];
  if(!segment||!/^[A-Za-z0-9_-]+$/.test(segment))return null;
  const decoded=atob(segment.replace(/-/g,'+').replace(/_/g,'/'));
  return JSON.parse(decoded);
 }catch{return null}
}
function userDb(token){
 return createClient(secret('SUPABASE_URL'),secret('SUPABASE_ANON_KEY'),{
  global:{headers:{Authorization:'Bearer '+token}},
  auth:{persistSession:false,autoRefreshToken:false}
 });
}
function serviceDb(){
 return createClient(secret('SUPABASE_URL'),secret('SUPABASE_SERVICE_ROLE_KEY'),{
  auth:{persistSession:false,autoRefreshToken:false}
 });
}
function cors(req){
 const origin=req.headers.get('origin')||'';
 if(['https://agentinfinitum.vercel.app','https://projectw1sc-crm.vercel.app'].includes(origin)
 || /^http:\/\/127\.0\.0\.1:(?:[1-9][0-9]{3,4})$/.test(origin)){
  return {'Access-Control-Allow-Origin':origin,'Vary':'Origin',
   'Access-Control-Allow-Headers':'Authorization, Content-Type',
   'Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
 }
 return {};
}
function json(req,data,status=200){
 return Response.json(data,{status,headers:{...cors(req),
  'Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}});
}
function adminRpc(db,name,args){return db.rpc(name,args)}
async function authorized(req,{requireMfa=true,client='firstparty'}={}){
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(!token||token.length>12000||!secret('SUPABASE_URL')||!secret('SUPABASE_ANON_KEY')||!secret('SUPABASE_SERVICE_ROLE_KEY'))
  throw Error('unauthorized');
 const db=userDb(token);
 const result=await db.auth.getUser(token);
 const jwt=claims(token),user=result.data?.user;
 if(result.error||!user||jwt?.sub!==user.id)throw Error('unauthorized');
 if(client==='firstparty'&&jwt?.client_id)throw Error('third_party_not_allowed');
 if(client==='oauth'&&(!jwt?.client_id||typeof jwt.client_id!=='string'))throw Error('oauth_required');
 // Supabase-issued session tokens must be at AAL2; user_metadata is NEVER trusted.
 if(requireMfa&&jwt?.aal!=='aal2')throw Error('mfa_required');
 const server=serviceDb();
 const role=await adminRpc(server,'killa_store_admin_access',{p_user_id:user.id});
 if(role.error||role.data?.allowed!==true)throw Error('superadmin_required');
 // Revoked/logged-out sessions must be denied even while their JWT has not expired.
 if(typeof jwt?.session_id!=='string'||!/^[-0-9a-f]{36}$/i.test(jwt.session_id))
  throw Error('session_revoked');
 const alive=await adminRpc(server,'killa_store_validate_session',{
  p_user_id:user.id,p_session_id:jwt.session_id
 });
 if(alive.error||alive.data!==true)throw Error('session_revoked');
 if(client==='oauth'){
  if(role.data.storeMcpEnabled!==true)throw Error('store_mcp_disabled');
  const permission=await db.from('killa_mcp_settings')
   .select('mcp_enabled,allowed_client_ids,require_mfa').eq('owner_id',user.id).maybeSingle();
  if(permission.error||permission.data?.mcp_enabled!==true||permission.data?.require_mfa!==true
   ||!Array.isArray(permission.data.allowed_client_ids)
   ||!permission.data.allowed_client_ids.includes(jwt.client_id))
   throw Error('oauth_client_not_allowed');
 }
 return {user,jwt,server,role:role.data};
}
function ghHeaders(write=false){
 const token=secret(write?'KILLA_GITHUB_DISPATCH_TOKEN':'KILLA_GITHUB_READ_TOKEN');
 const h={'Accept':'application/vnd.github+json','User-Agent':'W1-Killa-Store-Diagnostics',
  'X-GitHub-Api-Version':'2022-11-28'};
 if(token)h.Authorization='Bearer '+token;
 return h;
}
async function github(path,{method='GET',body,write=false}={}){
 // Hardcoded domain and exact project prevent arbitrary external requests/SSRF.
 if(!path.startsWith('/actions/')&&!path.startsWith('/releases/'))throw Error('unsupported_github_path');
 const url=GH_API+path;
 const res=await fetch(url,{method,headers:ghHeaders(write),
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(9000),
  redirect:'error'});
 if(method==='POST'){
  if(res.status!==204)throw Error('github_dispatch_rejected');
  return {ok:true};
 }
 if(!res.ok)throw Error('github_status_'+res.status);
 const raw=await res.text();
 if(raw.length>LIMIT)throw Error('github_response_too_large');
 return JSON.parse(raw);
}
function safeRun(run){
 return {id:run.id,status:escapeValue(run.status,24),conclusion:escapeValue(run.conclusion,24),
  name:escapeValue(run.name,72),branch:escapeValue(run.head_branch,45),
  sha:typeof run.head_sha==='string'&&/^[0-9a-f]{40}$/.test(run.head_sha)?run.head_sha.slice(0,10):null,
  createdAt:run.created_at,updatedAt:run.updated_at,
  url:typeof run.html_url==='string'&&run.html_url.startsWith('https://github.com/'+PROJECT+'/actions/runs/')
   ?run.html_url:null};
}
async function diagnostics(){
 const sources=await Promise.all(ALLOWED_WORKFLOWS.map(async name=>{
  try{
   const d=await github('/actions/workflows/'+encodeURIComponent(name)+'/runs?branch=main&per_page=5');
   return {workflow:name,runs:(d.workflow_runs||[]).slice(0,5).map(safeRun)};
  }catch{return {workflow:name,runs:[],error:'github_unavailable'}}
 }));
 return {workflows:sources,generatedAt:new Date().toISOString(),
  notice:'Somente resultados/etapas, sem log bruto ou credenciais de execução.'};
}
async function buildSteps(runId){
 if(!Number.isSafeInteger(runId)||runId<1)throw Error('invalid_run_id');
 const d=await github('/actions/runs/'+runId+'/jobs?per_page=25');
 return {runId,jobs:(d.jobs||[]).slice(0,25).map(job=>({
  name:escapeValue(job.name,72),conclusion:escapeValue(job.conclusion,25),
  status:escapeValue(job.status,25),
  url:job.html_url?.startsWith('https://github.com/'+PROJECT+'/actions/runs/')?job.html_url:null,
  steps:(job.steps||[]).slice(0,70).map(step=>({
   name:escapeValue(step.name,85),conclusion:escapeValue(step.conclusion,25),
   status:escapeValue(step.status,25),number:step.number
  }))
 })),notice:'Logs brutos permanecem no GitHub com autenticação e políticas próprias; sem dados de ambiente ou segredos na resposta.'};
}
function envState(){
 // NEVER return the value of any variable or GitHub environment secret.
 return {supabaseAuth:!!secret('SUPABASE_URL')&&!!secret('SUPABASE_ANON_KEY'),
  privateDatabase:!!secret('SUPABASE_SERVICE_ROLE_KEY'),
  githubReadCapability:!!secret('KILLA_GITHUB_READ_TOKEN'),
  githubDispatchCapability:!!secret('KILLA_GITHUB_DISPATCH_TOKEN'),
  githubSigningKey:'managed_only_in_protected_github_environment',
  policy:'presence_only_never_values'};
}
async function pendingRequests(ctx){
 const r=await adminRpc(ctx.server,'killa_store_requests',{p_user_id:ctx.user.id});
 if(r.error)throw Error('read_requests_failed');
 return r.data||[];
}
async function auditTrail(ctx){
 const r=await adminRpc(ctx.server,'killa_store_audit_summary',{p_user_id:ctx.user.id});
 if(r.error)throw Error('read_audit_failed');
 return r.data||[];
}
async function submitRequest(ctx,input){
 const version=String(input?.version||''),rationale=String(input?.reason||'').trim();
 if(!VALID_VERSION.test(version)||rationale.length<3||rationale.length>500)throw Error('invalid_release_request');
 const r=await adminRpc(ctx.server,'killa_store_request_release',{
  p_user_id:ctx.user.id,p_version:version,p_rationale:rationale,
  p_client_id:ctx.jwt?.client_id||null
 });
 if(r.error||!r.data)throw Error('duplicate_or_forbidden_request');
 return {id:r.data,version,status:'pending',approval_required:true,
  notice:'A IA solicitou a publicação, mas NÃO disparou GitHub Actions nem instalou nada. Confirme com MFA na loja.'};
}
async function approveRequest(ctx,input){
 if(ctx.jwt?.client_id)throw Error('first_party_only');
 // Require a FRESH TOTP (5 minutes), not just a stale AAL2 session.
 const recentTotp=Array.isArray(ctx.jwt?.amr)&&ctx.jwt.amr.some(m=>
  typeof m==='object'&&['totp','mfa/totp'].includes(m?.method)
  &&Number.isInteger(m?.timestamp)
  &&Math.abs(Date.now()/1000-m.timestamp)<=300);
 if(!recentTotp)throw Error('fresh_totp_required');
 const id=String(input?.requestId||''),version=String(input?.typedVersion||'');
 if(!/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(id)||!VALID_VERSION.test(version)
  ||input?.confirm!==true||input?.confirmation!=='PUBLICAR '+version)
  throw Error('explicit_confirmation_required');
 if(!secret('KILLA_GITHUB_DISPATCH_TOKEN'))throw Error('github_dispatch_not_configured');
 const claimed=await adminRpc(ctx.server,'killa_store_claim_release',{
  p_user_id:ctx.user.id,p_request_id:id,p_version:version
 });
 if(claimed.error||!claimed.data?.id)throw Error('expired_or_already_processed');
 let dispatched=false;
 try{
  await github('/actions/workflows/killa-desktop-free-release.yml/dispatches',{
   method:'POST',write:true,body:{ref:'main',inputs:{version}}
  });
  dispatched=true;
 }catch{dispatched=false}
 // Fail closed: network uncertainty is NOT retried automatically to avoid duplicates.
 const completed=await adminRpc(ctx.server,'killa_store_complete_release',{
  p_user_id:ctx.user.id,p_request_id:id,p_success:dispatched
 });
 if(completed.error)throw Error('release_audit_uncertain');
 return {id,version,status:dispatched?'dispatched':'uncertain',
  message:dispatched?'GitHub Actions recebeu a solicitação. A publicação ainda depende da aprovação do ambiente desktop-production.':
   'GitHub não confirmou o recebimento. Não repetir automaticamente; verificar o GitHub.'};
}
async function httpAdmin(req){
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
 const path=new URL(req.url).pathname;
 const action=path.split('/').pop();
 try{
  const ctx=await authorized(req,{requireMfa:action!=='access',client:'firstparty'});
  if(action==='access'&&req.method==='GET')
   return json(req,{ok:true,superadmin:true,needsMfa:ctx.jwt?.aal!=='aal2'});
  if(action==='status'&&req.method==='GET')
   return json(req,{ok:true,...await diagnostics(),env:envState(),permissions:ctx.role,
    requests:await pendingRequests(ctx),audit:await auditTrail(ctx)});
  if(action==='build-logs'&&req.method==='GET')
   return json(req,{ok:true,...await buildSteps(Number(new URL(req.url).searchParams.get('runId')))});
  if(action==='mcp-toggle'&&req.method==='POST'){
   const data=await req.json().catch(()=>null);
   if(typeof data?.enabled!=='boolean')return error('bad_request',400);
   const result=await adminRpc(ctx.server,'killa_store_toggle_mcp',{
    p_user_id:ctx.user.id,p_enabled:data.enabled
   });
   if(result.error)return error('forbidden');
   return json(req,{ok:true,storeMcpEnabled:data.enabled});
  }
  if(action==='request'&&req.method==='POST')
   return json(req,{ok:true,...await submitRequest(ctx,await req.json().catch(()=>null))});
  if(action==='approve'&&req.method==='POST')
   return json(req,{ok:true,...await approveRequest(ctx,await req.json().catch(()=>null))});
  return error('not_found',404);
 }catch(e){
  const code=String(e?.message||'forbidden');
  const rejected=['unauthorized','mfa_required','superadmin_required','third_party_not_allowed',
   'oauth_client_not_allowed','oauth_required','store_mcp_disabled','invalid_request',
   'session_revoked','fresh_totp_required'];
  return json(req,{ok:false,error:code},rejected.includes(code)?403:code==='github_dispatch_not_configured'?503:400);
 }
}
function result(value){return {content:[{type:'text',text:JSON.stringify(value)}]}}
async function oauthMcp(req){
 try{
  const ctx=await authorized(req,{requireMfa:true,client:'oauth'});
  const handler=createMcpHandler(()=>{
   const server=new McpServer({name:'w1-capital-store-admin',version:'1.0.0'});
   server.registerTool('killa_store_status',{
    title:'Killa Loja · estado da publicação',description:'Últimos builds, typecheck e logs de etapas, sem segredos.',
    inputSchema:z.object({}),annotations:{readOnlyHint:true}
   },async()=>result({ok:true,...await diagnostics()}));
   server.registerTool('killa_store_build_logs',{
    title:'Killa Loja · etapas do build',description:'Retorna etapas seguras de um run oficial, nunca logs brutos ou env.',
    inputSchema:z.object({runId:z.number().int().positive()}),annotations:{readOnlyHint:true}
   },async({runId})=>result(await buildSteps(runId)));
   server.registerTool('killa_store_request_release',{
    title:'Killa Loja · solicitar publicação',description:'SOMENTE cria solicitação sujeita a MFA e aprovação humana na loja. Não publica.',
    inputSchema:z.object({version:z.string().regex(VALID_VERSION),reason:z.string().min(3).max(500)})
   },async(input)=>result(await submitRequest(ctx,input)));
   server.registerTool('killa_store_request_status',{
    title:'Killa Loja · estado das solicitações',description:'Consulta solicitações da conta superadmin autenticada.',
    inputSchema:z.object({}),annotations:{readOnlyHint:true}
   },async()=>result({requests:await pendingRequests(ctx)}));
   return server;
  });
  const response=await handler.fetch(req);
  const headers=new Headers(response.headers);
  headers.set('Cache-Control','no-store');
  headers.set('X-Content-Type-Options','nosniff');
  return new Response(response.body,{status:response.status,headers});
 }catch{return new Response(JSON.stringify({error:'unauthorized'}),{status:403,
  headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}
}
const secureMcp=pipeline([withOAuthProtectedResource()],async(req)=>oauthMcp(req));
Deno.serve(async req=>{
 const path=new URL(req.url).pathname;
 if(path.endsWith('/mcp'))return secureMcp(req);
 return httpAdmin(req);
});
