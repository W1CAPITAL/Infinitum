import {officeAuth,officeJson,safeOfficeError} from '../../../../../../lib/office-server.mjs';
import {authorizationUrl,getConnector} from '../../../../../../lib/openbot-connectors.mjs';
import {encryptOAuthState,newOAuthNonce,oauthPkce,providerCredentials,oauthRedirectUri}
 from '../../../../../../lib/openbot-connection-server.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request){
 try{
  const {db,user}=await officeAuth(request);
  const body=await request.json().catch(()=>({}));
  const provider=String(body.provider||'');
  if(!['google','meta'].includes(provider))throw Object.assign(Error('Provedor indisponível.'),{status:400});
  const connectorId=provider==='google'?String(body.connectorId||'drive'):'';
  if(provider==='google'&&getConnector(connectorId)?.provider!=='google')throw Object.assign(Error('Serviço Google inválido.'),{status:400});
  const {clientId}=providerCredentials(provider);
  const nonce=newOAuthNonce(),pkce=oauthPkce();
  const result=await db.from('openbot_oauth_states').insert({
   nonce,owner_id:user.id,provider,expires_at:new Date(Date.now()+10*60_000).toISOString()
  });
  if(result.error)throw Object.assign(Error('Não foi possível iniciar OAuth: '+result.error.message),{status:503});
  const state=encryptOAuthState({provider,connectorId,ownerId:user.id,nonce,verifier:pkce.verifier});
  const url=authorizationUrl(provider,{clientId,redirectUri:oauthRedirectUri(provider),state,challenge:pkce.challenge,connectorId});
  return officeJson({ok:true,provider,connectorId,authorizationUrl:url,expiresInSeconds:600,
   notice:'Abra a janela do provedor e aprove as permissões. O OpenBot não terá acesso até receber a confirmação.'});
 }catch(e){return safeOfficeError(e)}
}
