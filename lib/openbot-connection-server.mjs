import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {providerConfigured} from './openbot-connectors.mjs';

const PUBLIC_ORIGIN='https://agentinfinitum.vercel.app';
const TOKEN_PREFIX='v1';
const MAX_AGE_MS=10*60*1000;
function fail(message,status=503){throw Object.assign(Error(message),{status})}
function cipherKey(env=process.env){
 const raw=env.OPENBOT_TOKEN_CIPHER_KEY||'';
 // 32 raw bytes encoded as Base64 or Base64URL, never a short human password.
 if(!/^[a-zA-Z0-9_-]{43,44}={0,2}$/.test(raw))fail('Configure OPENBOT_TOKEN_CIPHER_KEY no servidor (32 bytes aleatórios em base64url).');
 const k=Buffer.from(raw,'base64url');
 if(k.length!==32)fail('Chave AES do OpenBot inválida.');
 return k;
}
export function encryptToken(value,env=process.env){
 const nonce=randomBytes(12);
 const crypt=createCipheriv('aes-256-gcm',cipherKey(env),nonce);
 const data=Buffer.from(JSON.stringify(value),'utf8');
 if(data.length>14000)fail('Dados de autorização excederam o tamanho permitido.',400);
 const enc=Buffer.concat([crypt.update(data),crypt.final()]);
 return [TOKEN_PREFIX,nonce.toString('base64url'),enc.toString('base64url'),crypt.getAuthTag().toString('base64url')].join('.');
}
export function decryptToken(blob,env=process.env){
 const [v,n,p,t,...extra]=String(blob||'').split('.');
 if(v!==TOKEN_PREFIX||!n||!p||!t||extra.length)fail('Estado de autorização inválido.',400);
 try{
  const iv=Buffer.from(n,'base64url'),tag=Buffer.from(t,'base64url');
  if(iv.length!==12||tag.length!==16)throw Error('Bad nonce');
  const decipher=createDecipheriv('aes-256-gcm',cipherKey(env),iv);
  decipher.setAuthTag(tag);
  const output=Buffer.concat([decipher.update(Buffer.from(p,'base64url')),decipher.final()]);
  return JSON.parse(output.toString('utf8'));
 }catch{fail('A autorização expirou ou foi alterada. Inicie uma nova conexão.',400)}
}
export function encryptOAuthState(payload,env=process.env){
 return encryptToken({...payload,purpose:'openbot-oauth',issued:Date.now()},env);
}
export function decryptOAuthState(blob,env=process.env){
 const decoded=decryptToken(blob,env);
 if(decoded?.purpose!=='openbot-oauth'||!decoded.ownerId||!decoded.nonce
 ||!Number.isFinite(decoded.issued)||Date.now()-decoded.issued>MAX_AGE_MS
 ||decoded.issued-Date.now()>60_000)fail('Autorização OAuth expirada. Inicie novamente.',400);
 return decoded;
}
export function adminClient(env=process.env){
 const url=env.NEXT_PUBLIC_SUPABASE_URL;
 const key=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!key)
  fail('Administração: configure SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SECRET_KEY somente no servidor.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function publicOAuthOrigin(){
 return PUBLIC_ORIGIN;
}
export function oauthRedirectUri(provider){
 if(!['google','meta'].includes(provider))fail('Provedor desconhecido.',400);
 return PUBLIC_ORIGIN+'/api/openbot/integrations/oauth/callback';
}
export function providerCredentials(provider,env=process.env){
 if(!providerConfigured(provider,env))fail('Conexão '+provider+' ainda não configurada no servidor. Cadastre as credenciais OAuth primeiro.');
 // Service credential required for a callback to store the encrypted token once the browser leaves the session.
 adminClient(env);
 if(provider==='google')return {clientId:env.OPENBOT_GOOGLE_CLIENT_ID,secret:env.OPENBOT_GOOGLE_CLIENT_SECRET};
 if(provider==='meta')return {clientId:env.OPENBOT_META_APP_ID,secret:env.OPENBOT_META_APP_SECRET};
 fail('Provedor não suportado.',400);
}
export function newOAuthNonce(){return randomBytes(32).toString('base64url')}
export function oauthPkce(){
 const verifier=randomBytes(32).toString('base64url');
 const challenge=createHash('sha256').update(verifier).digest('base64url');
 return {verifier,challenge};
}
export function forbidPrivateRedirect(target){
 if(typeof target!=='string')return '/openbot?integrations=1';
 const value=target.startsWith('/openbot')&&!target.startsWith('//')?target:'/openbot?integrations=1';
 return value.slice(0,100);
}
export function errorToSafeCode(message){
 return String(message||'unknown').slice(0,160).replace(/[^\w\s.:-]/g,'');
}
