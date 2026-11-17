import {validatedPublicOrigin} from '../../../../lib/openbot-public-origin.mjs';
// Public identifiers only. Windows wrapper uses this to match the live CRM identity.
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
 const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'';
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)||!publishableKey)
  return Response.json({ok:false,error:'Configuração pública do CRM indisponível.'},{status:503,headers:{'Cache-Control':'no-store'}});
 return Response.json({supabaseUrl,publishableKey,
  bridgeOrigin:'https://lexispredict-wa-auto.onrender.com',
  remoteOrigin:validatedPublicOrigin(process.env.NEXT_PUBLIC_SITE_URL),
  sharedCrm:true},{headers:{'Cache-Control':'public,max-age=90','X-Content-Type-Options':'nosniff'}});
}
