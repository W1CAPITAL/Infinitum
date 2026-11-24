import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,open,rename,rm,stat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {spawn} from 'node:child_process';
import {
 LATEST_SIGNED_MANIFEST,verifyUpdateManifest,trustedHttpsUrl,pinnedKeyMatches
} from './release-trust.mjs';

const MANIFEST_LIMIT=12000;
export const MANIFEST_TIMEOUT_MS=18000;
export const INSTALLER_TIMEOUT_MS=60*60*1000;
const REDIRECT_LIMIT=7;
const HEADERS={'User-Agent':'W1-Capital-Killa-Launcher/1.0',
 Accept:'application/octet-stream, application/json'};
export async function fetchTrustedResponse(start,fetchImpl=fetch,{timeoutMs=MANIFEST_TIMEOUT_MS}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>INSTALLER_TIMEOUT_MS)throw Error('Prazo de transferência inválido.');
 const signal=AbortSignal.timeout(timeoutMs);
 let url=start;
 for(let i=0;i<=REDIRECT_LIMIT;i++){
  if(!trustedHttpsUrl(url))throw Error('Redirecionamento fora das origens oficiais do GitHub.');
  const response=await fetchImpl(url,{method:'GET',redirect:'manual',
   headers:HEADERS,signal});
  if([301,302,303,307,308].includes(response.status)){
   const location=response.headers.get('location');
   if(!location)throw Error('Redirecionamento sem destino verificado.');
   await response.body?.cancel().catch(()=>{});
   url=new URL(location,url).href;
   continue;
  }
  if(response.status===404)return null;
  if(!response.ok)throw Error('Servidor de releases indisponível ('+response.status+').');
  return response;
 }
 throw Error('Cadeia de redirecionamentos excessiva.');
}
async function readBounded(response,maxBytes=MANIFEST_LIMIT){
 if(!response?.body)throw Error('Resposta de atualização vazia.');
 let size=0;
 const chunks=[];
 for await(const chunk of response.body){
  const part=Buffer.from(chunk);
  size+=part.length;
  if(size>maxBytes)throw Error('Manifesto de atualização muito grande.');
  chunks.push(part);
 }
 return Buffer.concat(chunks).toString('utf8');
}
async function fileHash(path){
 const sha=createHash('sha512');
 for await(const chunk of createReadStream(path))sha.update(chunk);
 return sha.digest();
}
function verifiedHash(computed,expected){
 const reference=Buffer.from(expected,'base64');
 return reference.length===64&&computed.length===64&&timingSafeEqual(reference,computed);
}
export async function downloadVerifiedInstaller({app,manifest,onProgress=()=>{},fetchImpl=fetch}){
 if(!app||!manifest?.asset?.name)throw Error('Manifesto verificado obrigatório.');
 const dir=join(app.getPath('userData'),'signed-updates');
 await mkdir(dir,{recursive:true,mode:0o700});
 const filename=manifest.asset.name;
 if(!/^INFINITUM-KillaAI-Setup-\d+\.\d+\.\d+-x64\.exe$/.test(filename))
  throw Error('Nome de instalador não autorizado.');
 const target=join(dir,filename);
 // Reuse a previous download only if the current, signed SHA512 still matches.
 try{
  const size=await stat(target);
  if(size.isFile()&&size.size===manifest.asset.size&&
   verifiedHash(await fileHash(target),manifest.asset.sha512)){
   onProgress(100);
   return target;
  }
 }catch{}
 const temp=join(dir,filename+'.partial-'+randomBytes(8).toString('hex'));
 let handle=null,count=0;
 const sha=createHash('sha512');
 try{
  const response=await fetchTrustedResponse(manifest.asset.url,fetchImpl,{timeoutMs:INSTALLER_TIMEOUT_MS});
  if(!response?.body)throw Error('Instalador oficial não disponível.');
  handle=await open(temp,'wx',0o600);
  for await(const chunk of response.body){
   const data=Buffer.from(chunk);
   count+=data.length;
   if(count>manifest.asset.size)throw Error('Tamanho ultrapassou o manifesto assinado.');
   sha.update(data);
   let offset=0;
   while(offset<data.length){
    const result=await handle.write(data,offset,data.length-offset);
    if(!result?.bytesWritten)throw Error('Falha na escrita de atualização.');
    offset+=result.bytesWritten;
   }
   onProgress(Math.floor(count/manifest.asset.size*100));
  }
  await handle.sync();
  await handle.close();handle=null;
  if(count!==manifest.asset.size||!verifiedHash(sha.digest(),manifest.asset.sha512))
   throw Error('Hash SHA-512 não corresponde ao manifesto da W1 Capital.');
  await rm(target,{force:true});
  await rename(temp,target);
  onProgress(100);
  return target;
 }catch(error){
  if(handle)await handle.close().catch(()=>{});
  await rm(temp,{force:true}).catch(()=>{});
  throw error;
 }
}
export async function verifyLocalInstaller(path,manifest){
 const size=await stat(path);
 if(!size.isFile()||size.size!==manifest.asset.size)
  throw Error('Arquivo de atualização foi modificado.');
 if(!verifiedHash(await fileHash(path),manifest.asset.sha512))
  throw Error('Assinatura de integridade do instalador inválida.');
 return true;
}
export async function launchVerifiedInstaller({path,manifest,spawnImpl=spawn}){
 await verifyLocalInstaller(path,manifest);
 // NSIS per-user install (/S). The app is quit only AFTER Windows launches
 // this exact EXE whose bytes were authenticated with pinned Ed25519 metadata.
 const child=spawnImpl(path,['/S'],{
  cwd:dirname(path),windowsHide:true,detached:true,
  shell:false,stdio:'ignore'
 });
 if(!child||typeof child.unref!=='function')throw Error('Não foi possível executar instalador verificado.');
 await new Promise((resolve,reject)=>{
  child.once('error',reject);
  child.once('spawn',resolve);
 });
 child.unref();
 return {started:true};
}
export function createFreeUpdater({app,publicKey,onState=()=>{},fetchImpl=fetch}){
 if(!app||!publicKey||!pinnedKeyMatches(publicKey))throw Error('Chave pública W1 Capital inválida; atualizações bloqueadas.');
 let lastManifest=null,lastPath=null;
 const tell=state=>onState(state);
 return Object.freeze({
  async check(){
   lastManifest=null;lastPath=null;
   tell({phase:'checking',signed:true,downloaded:false,
    message:'Verificando versões aprovadas pela W1 Capital, sem Vercel.'});
   const response=await fetchTrustedResponse(LATEST_SIGNED_MANIFEST,fetchImpl);
   if(!response){
    tell({phase:'ready',signed:true,downloaded:false,
     message:'Nenhuma atualização oficial publicada. Continue com a versão instalada.'});
    return {status:'ready'};
   }
   const raw=await readBounded(response);
   let doc;
   try{doc=JSON.parse(raw)}catch{throw Error('Manifesto oficial não contém JSON válido.')}
   let manifest;
   try{manifest=verifyUpdateManifest(doc,publicKey,app.getVersion())}
   catch(error){
    if(String(error?.message||'').includes('Não há nova versão')){
     tell({phase:'ready',signed:true,downloaded:false,message:'Você está na versão oficial mais recente.'});
     return {status:'ready'};
    }
    throw error;
   }
   tell({phase:'downloading',signed:true,downloaded:false,updateVersion:manifest.version,
    percent:0,message:'Baixando versão aprovada. SHA-512 e assinatura Ed25519 serão verificados.'});
   const verifiedPath=await downloadVerifiedInstaller({app,manifest,fetchImpl,
    onProgress:percent=>tell({phase:'downloading',signed:true,downloaded:false,
     percent,updateVersion:manifest.version,message:'Baixando pacote oficial da W1 Capital.'})});
   lastManifest=manifest;lastPath=verifiedPath;
   tell({phase:'downloaded',signed:true,downloaded:true,percent:100,
    updateVersion:manifest.version,
    message:'Atualização W1 Capital autenticada. Instalação local disponível.'});
   return {status:'downloaded',version:manifest.version};
  },
  async install(){
   if(!lastManifest||!lastPath)throw Error('Nenhuma atualização oficial autenticada.');
   const result=await launchVerifiedInstaller({path:lastPath,manifest:lastManifest});
   return result;
  }
 });
}
