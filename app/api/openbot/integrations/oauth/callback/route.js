import {adminClient,decryptOAuthState,encryptToken,decryptToken,providerCredentials,oauthRedirectUri,publicOAuthOrigin}
 from '../../../../../../lib/openbot-connection-server.mjs';
import {getGoogleScopes,META_OAUTH_SCOPES} from '../../../../../../lib/openbot-connectors.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// NEXT_PUBLIC_SITE_URL determines the official OAuth return site.
const timeout=()=>AbortSignal.timeout(16000);
const safeRedirect=(code,provider='')=>{
 let root;
 try{root=publicOAuthOrigin()}catch{return Response.json({error:'Origem pública do OpenBot não configurada.'},{status:503})}
 const u=new URL('/openbot',root);
 u.searchParams.set('integrations','1');
 u.searchParams.set(code==='connected'?'connected':'oauth_error',code==='connected'?provider:code);
 return Response.redirect(u.toString(),303);
};
const safeResult=async r=>{
 const raw=await r.text();
 if(raw.length>24000)throw Error('Resposta OAuth excessiva');
 try{return JSON.parse(raw)}catch{throw Error('Resposta OAuth inválida')}
};
async function exchange(provider,code,credentials,verifier,connectorId){
 const callback=oauthRedirectUri(provider);
 if(provider==='google'){
  const body=new URLSearchParams({client_id:credentials.clientId,client_secret:credentials.secret,redirect_uri:callback,
   grant_type:'authorization_code',code,code_verifier:verifier});
  const response=await fetch('https://oauth2.googleapis.com/token',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString(),signal:timeout(),cache:'no-store'});
  const json=await safeResult(response);
  if(!response.ok||!json.access_token)throw Error('Google recusou a autorização.');
  const userResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{
   headers:{Authorization:'Bearer '+json.access_token},signal:timeout(),cache:'no-store'});
  const user=await safeResult(userResponse);
  if(!userResponse.ok||!user.sub)throw Error('Não foi possível identificar a conta Google.');
  return {externalAccountId:String(user.sub).slice(0,200),displayName:String(user.name||user.email||'Conta Google').slice(0,240),
   email:String(user.email||'').slice(0,240),token:json,scopes:String(json.scope||getGoogleScopes(connectorId||'drive').join(' ')).split(/\s+/),
   expiresAt:Number(json.expires_in)>0?new Date(Date.now()+Number(json.expires_in)*1000).toISOString():null};
 }
 if(provider==='meta'){
  const params=new URLSearchParams({client_id:credentials.clientId,client_secret:credentials.secret,
   redirect_uri:callback,code});
  const response=await fetch('https://graph.facebook.com/v24.0/oauth/access_token?'+params,{
   signal:timeout(),cache:'no-store'});
  const json=await safeResult(response);
  if(!response.ok||!json.access_token)throw Error('Meta recusou a autorização.');
  const info=await fetch('https://graph.facebook.com/v24.0/me?fields=id,name&access_token='+encodeURIComponent(json.access_token),{
   signal:timeout(),cache:'no-store'});
  const me=await safeResult(info);
  if(!info.ok||!me.id)throw Error('Não foi possível identificar a conta Meta.');
  return {externalAccountId:String(me.id).slice(0,200),displayName:String(me.name||'Meta').slice(0,240),
   email:'',token:json,scopes:META_OAUTH_SCOPES,
   expiresAt:Number(json.expires_in)>0?new Date(Date.now()+Number(json.expires_in)*1000).toISOString():null};
 }
 throw Error('Provedor não suportado');
}
export async function GET(request){
 const url=new URL(request.url),code=url.searchParams.get('code')||'';
 const state=url.searchParams.get('state')||'';
 if(url.searchParams.get('error'))return safeRedirect('provider_denied');
 if(code.length<8||code.length>4096||state.length<40||state.length>6500)return safeRedirect('invalid_callback');
 try{
  const payload=decryptOAuthState(state);
  const {provider,connectorId,ownerId,nonce,verifier}=payload;
  if(!['google','meta'].includes(provider)||!/^[A-Za-z0-9_-]{36,100}$/.test(nonce))return safeRedirect('invalid_state');
  const credentials=providerCredentials(provider);
  const admin=adminClient();
  // A single-use state is consumed BEFORE the code exchange.
  const used=await admin.from('openbot_oauth_states').update({used_at:new Date().toISOString()})
   .eq('nonce',nonce).eq('owner_id',ownerId).eq('provider',provider)
   .is('used_at',null).gt('expires_at',new Date().toISOString()).select('nonce').maybeSingle();
  if(used.error||!used.data)return safeRedirect('state_expired');
  const account=await exchange(provider,code,credentials,verifier,connectorId);
  const old=await admin.from('openbot_connections').select('tokens_ciphertext,scopes')
   .eq('owner_id',ownerId).eq('provider',provider).eq('external_account_id',account.externalAccountId).maybeSingle();
  if(old.error)throw Error('Falha ao consultar autorização anterior');
  let savedToken={...account.token};
  if(!savedToken.refresh_token&&old.data?.tokens_ciphertext){
   try{const prior=decryptToken(old.data.tokens_ciphertext);
    if(prior?.refresh_token)savedToken.refresh_token=prior.refresh_token;}catch{}
  }
  const grantedScopes=[...new Set([...(Array.isArray(old.data?.scopes)?old.data.scopes:[]),...account.scopes])];
  const payloadInsert={owner_id:ownerId,provider,external_account_id:account.externalAccountId,
   display_name:account.displayName,email:account.email,scopes:grantedScopes,status:'connected',
   tokens_ciphertext:encryptToken(savedToken),expires_at:account.expiresAt,
   last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const write=await admin.from('openbot_connections').upsert(payloadInsert,
   {onConflict:'owner_id,provider,external_account_id'}).select('id').single();
  if(write.error||!write.data)throw Error('A autorização não pôde ser salva.');
  return safeRedirect('connected',provider);
 }catch(error){
  console.error('openbot-oauth-failed',String(error?.message||'OAuth failed').slice(0,100));
  return safeRedirect('failed');
 }
}
