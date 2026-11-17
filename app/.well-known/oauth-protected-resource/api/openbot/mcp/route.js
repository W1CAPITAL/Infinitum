export const dynamic='force-dynamic';
export function GET(){
 return Response.json({
  resource:'https://agentinfinitum.vercel.app/api/openbot/mcp',
  authorization_servers:['https://segjskjlbeydlljnefai.supabase.co/auth/v1'],
  scopes_supported:['openid','profile','email']
 },{headers:{'Content-Type':'application/json','Cache-Control':'public,max-age=300'}});
}
