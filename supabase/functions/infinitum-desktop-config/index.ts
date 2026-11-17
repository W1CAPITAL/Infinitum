// Public identifiers only; NEVER expose JWT service-role, OAuth secrets or user data.
const SUPABASE_PROJECT='https://segjskjlbeydlljnefai.supabase.co';
const BRIDGE_ORIGIN='https://lexispredict-wa-auto.onrender.com';
function safeOrigin(value:string|null):string|null{
 const raw=String(value||'').trim();
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||
   (u.pathname!==''&&u.pathname!=='/')||
   !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(u.hostname)||
   /(^|\.)vercel\.app$/.test(u.hostname))return null;
  return u.origin;
 }catch{return null}
}
Deno.serve((request:Request)=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{
   'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS',
   'Access-Control-Allow-Headers':'Content-Type, apikey'}});
 if(request.method!=='GET')return Response.json({error:'Método não permitido.'},{status:405,
   headers:{'Cache-Control':'no-store'}});
 const supabaseUrl=Deno.env.get('SUPABASE_URL')||'';
 const publishableKey=Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||Deno.env.get('SUPABASE_ANON_KEY')||'';
 if(supabaseUrl!==SUPABASE_PROJECT||!publishableKey||
  !(/^sb_publishable_[A-Za-z0-9._-]{12,}$/.test(publishableKey)||
   /^[\w-]+\.[\w-]+\.[\w-]+$/.test(publishableKey))){
  return Response.json({error:'Identificadores públicos do projeto indisponíveis.'},{status:503,
   headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 return Response.json({
  supabaseUrl:SUPABASE_PROJECT,
  publishableKey,
  bridgeOrigin:BRIDGE_ORIGIN,
  remoteOrigin:safeOrigin(Deno.env.get('INFINITUM_CANONICAL_ORIGIN'))
 },{
  headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*',
   'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}
 });
});
