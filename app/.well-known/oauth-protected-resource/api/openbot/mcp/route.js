import {publicOAuthOrigin} from '../../../../../../lib/openbot-public-origin.mjs';
export const dynamic='force-dynamic';
export function GET(){
 try{
  // NEXT_PUBLIC_SITE_URL is the configured HTTPS origin, never a Vercel fallback.
  const origin=publicOAuthOrigin(process.env);
  return Response.json({
   resource:origin+'/api/openbot/mcp',
   authorization_servers:['https://segjskjlbeydlljnefai.supabase.co/auth/v1'],
   scopes_supported:['openid','profile','email']
  },{headers:{'Content-Type':'application/json','Cache-Control':'public,max-age=300'}});
 }catch{
  return Response.json({error:'Origem pública do MCP não configurada.'},{
   status:503,headers:{'Cache-Control':'no-store'}});
 }
}
