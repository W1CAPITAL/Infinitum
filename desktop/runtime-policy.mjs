import {validatedPublicOrigin} from '../lib/openbot-public-origin.mjs';
// Main CRM route renders login through SecuredWorkspace; /login does not exist.
export const DESKTOP_ENTRY_PATH='/';
// Independent ZapFast web session, never an implicit WA.Auto/CRM account.
export const DESKTOP_ZAPFAST_URL='https://zapfast-cloudflare-web.daviconcentrix.workers.dev/';
const PROJECT='https://segjskjlbeydlljnefai.supabase.co';
const WA='https://lexispredict-wa-auto.onrender.com';
const PORT_MIN=1024,PORT_MAX=65535;
const PUBLIC_JWT_PATTERN=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
function isPublicKey(value){
 if(/^sb_publishable_[A-Za-z0-9._-]{12,}$/.test(value))return true;
 if(!PUBLIC_JWT_PATTERN.test(value))return false;
 try{
  const payload=JSON.parse(Buffer.from(value.split('.')[1],'base64url').toString('utf8'));
  return payload?.role==='anon'&&payload?.iss?.includes('supabase');
 }catch{return false}
}
export function validateDesktopConfig(config){
 if(!config||config.supabaseUrl!==PROJECT)throw Error('Projeto Supabase não autorizado para o aplicativo.');
 if(!isPublicKey(String(config.publishableKey||'')))
  throw Error('É necessária somente chave pública publishable/anon; credencial secreta é proibida.');
 if(config.bridgeOrigin!==WA)throw Error('WA.Auto exige o endpoint HTTPS fixo e autorizado.');
 const specified=String(config.remoteOrigin||'').trim();
 const remoteOrigin=validatedPublicOrigin(specified);
 if(specified&&!remoteOrigin)throw Error('Origem HTTPS do CRM inválida: domínio Vercel, porta e endereço privado são bloqueados.');
 return Object.freeze({supabaseUrl:PROJECT,publishableKey:config.publishableKey,bridgeOrigin:WA,remoteOrigin});
}
export function safeStandaloneEnvironment(config,port,systemEnv=process.env){
 const allowed=validateDesktopConfig(config);
 if(!Number.isInteger(port)||port<PORT_MIN||port>PORT_MAX)
  throw Error('Porta local inválida.');
 const safe={};
 for(const name of ['PATH','Path','SystemRoot','WINDIR','HOME','USERPROFILE','TEMP','TMP','APPDATA','LOCALAPPDATA','LANG','TZ']){
  if(typeof systemEnv[name]==='string')safe[name]=systemEnv[name];
 }
 return {...safe,
  ELECTRON_RUN_AS_NODE:'1',
  NODE_ENV:'production',
  HOSTNAME:'127.0.0.1',
  PORT:String(port),
  NEXT_PUBLIC_SUPABASE_URL:allowed.supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:allowed.publishableKey,
  NEXT_PUBLIC_LEXIS_SHARED_DB:'1',
  ...(allowed.remoteOrigin?{OPENBOT_DESKTOP_REMOTE:allowed.remoteOrigin}:{}),
  WA_AUTO_URL:allowed.bridgeOrigin
 };
}
export function isLocalAppNavigation(value,port){
 if(!Number.isInteger(port)||port<PORT_MIN||port>PORT_MAX)return false;
 try{
  const url=new URL(value);
  return url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.port===String(port)
    &&url.username===''&&url.password==='';
 }catch{return false}
}
export function isSafeExternalNavigation(value){
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password)return false;
  const host=url.hostname.toLowerCase();
  return ['github.com','docs.github.com','supabase.com','www.supabase.com',
   'whatsapp.com','www.whatsapp.com','wa.me','accounts.google.com',
   'www.facebook.com','facebook.com',
   // Open only this exact separately authenticated ZapFast site in the system browser.
   'zapfast-cloudflare-web.daviconcentrix.workers.dev'].includes(host)
   ||(host.endsWith('.supabase.co')&&/^[a-z0-9-]+\.supabase\.co$/.test(host));
 }catch{return false}
}
export function isSafeZapFastNavigation(value){
 try{
  const url=new URL(value);
  return url.protocol==='https:'&&url.origin===new URL(DESKTOP_ZAPFAST_URL).origin&&
    url.username===''&&url.password==='';
 }catch{return false}
}
export function shouldRunSignedUpdater({packaged=false,win32=false,signedMarker=false}={}){
 return packaged===true&&win32===true&&signedMarker===true;
}
