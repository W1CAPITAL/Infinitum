// Public discovery only. Protected tools still require a valid Supabase session.
export const KILLA_MCP_URL='https://agentinfinitum.vercel.app/mcp';
export const KILLA_MCP_METADATA='https://agentinfinitum.vercel.app/.well-known/oauth-protected-resource/mcp';
export function killaResourceMetadata(url=process.env.NEXT_PUBLIC_SUPABASE_URL){
 let auth=null;try{
  const u=new URL(url||'');
  if(u.protocol==='https:'&&!u.username&&!u.password)auth=u.origin+'/auth/v1';
 }catch{}
 return auth?{resource:KILLA_MCP_URL,authorization_servers:[auth],
  bearer_methods_supported:['header'],scopes_supported:['openid','email','profile','offline_access'],
  resource_name:'INFINITUM Killa AI (somente leitura e rascunhos)'}:null;
}
export function killaMcpUnauthorized(){
 return Response.json({error:'Autenticação OAuth 2.1 ou Supabase obrigatória.'},{
  status:401,headers:{'Cache-Control':'no-store',
   'WWW-Authenticate':'Bearer resource_metadata="'+KILLA_MCP_METADATA+'", scope="openid email offline_access"'}});
}
