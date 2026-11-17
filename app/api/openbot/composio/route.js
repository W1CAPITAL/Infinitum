import {randomBytes} from 'node:crypto';
import {officeAuth,officeJson,safeOfficeError} from '../../../../lib/office-server.mjs';
import {adminClient,newOAuthNonce} from '../../../../lib/openbot-connection-server.mjs';
import {COMPOSIO_TOOLKITS,composioConfigured,listComposioToolkits,startComposioConnection,deleteComposioAccount}
 from '../../../../lib/openbot-composio.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ORIGIN='https://agentinfinitum.vercel.app';

export async function GET(request){
 try{
  const {user}=await officeAuth(request);
  if(!composioConfigured())return officeJson({ok:true,configured:false,apps:[],toolkits:COMPOSIO_TOOLKITS});
  const admin=adminClient();
  const apps=await listComposioToolkits(user.id,admin);
  return officeJson({ok:true,configured:true,apps,toolkits:COMPOSIO_TOOLKITS});
 }catch(e){return safeOfficeError(e)}
}

export async function POST(request){
 try{
  const {user}=await officeAuth(request);
  if(!composioConfigured())throw Object.assign(Error('Cadastre COMPOSIO_API_KEY nas variáveis sensíveis da Vercel.'),{status:503});
  const body=await request.json().catch(()=>({}));
  const toolkit=String(body.toolkit||'').trim().toLowerCase();
  if(!COMPOSIO_TOOLKITS.includes(toolkit))throw Object.assign(Error('Selecione Instagram ou WhatsApp Business.'),{status:400});
  const nonce=newOAuthNonce();
  const callbackUrl=ORIGIN+'/api/openbot/composio/callback?state='+encodeURIComponent(nonce);
  const alias='infinitum-'+toolkit+'-'+randomBytes(4).toString('hex');
  const admin=adminClient();
  const link=await startComposioConnection(user.id,toolkit,callbackUrl,alias,admin);
  if(!/^ca_[A-Za-z0-9_-]{6,180}$/.test(link.connectedAccountId))
   throw Object.assign(Error('Composio não retornou o identificador da conta conectada.'),{status:502});
  const saved=await admin.from('openbot_composio_states').insert({
   nonce,owner_id:user.id,toolkit,expected_account_id:link.connectedAccountId,
   expires_at:new Date(Date.now()+10*60_000).toISOString()
  });
  if(saved.error)throw Object.assign(Error('Não foi possível proteger o retorno OAuth no Supabase.'),{status:503});
  return officeJson({ok:true,toolkit,redirectUrl:link.redirectUrl,expiresInSeconds:600,
   notice:'A autorização será concluída no Composio. As credenciais permanecem no Composio e não passam pelo navegador do INFINITUM.'});
 }catch(e){return safeOfficeError(e)}
}

export async function DELETE(request){
 try{
  const {user}=await officeAuth(request);
  const body=await request.json().catch(()=>({}));
  const result=await deleteComposioAccount(user.id,body.connectedAccountId,adminClient());
  return officeJson({ok:true,removed:result.removed,
   notice:'Conta removida do Composio e credencial externa revogada.'});
 }catch(e){return safeOfficeError(e)}
}
