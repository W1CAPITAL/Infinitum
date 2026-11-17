import {createPublicKey,createHash,verify} from 'node:crypto';
const REPO='ProjectW1SC/INFINITUM';
const APP_ID='br.com.w1capital.infinitum.killa';
const VERSION=/^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;
const PUBLIC_FINGERPRINT='64226fb4ce21332768a8779be5548acdddd4933f0be48cfc35751884ca481d3c';
export const LATEST_SIGNED_MANIFEST='https://github.com/'+REPO+'/releases/latest/download/killa-update.json';
export const ALLOWED_RELEASE_HOSTS=new Set([
 'github.com','release-assets.githubusercontent.com','objects.githubusercontent.com','github-releases.githubusercontent.com'
]);
function rejected(reason){throw Error(reason)}
export function validVersion(value){
 return typeof value==='string'&&VERSION.test(value);
}
export function versionIsNewer(candidate,installed){
 if(!validVersion(candidate)||!validVersion(installed))return false;
 const a=candidate.split('.').map(Number),b=installed.split('.').map(Number);
 for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i]}
 return false;
}
export function releaseArtifactUrl(version){
 if(!validVersion(version))rejected('Versão de release inválida.');
 return 'https://github.com/'+REPO+'/releases/download/v'+version+'/INFINITUM-KillaAI-Setup-'+version+'-x64.exe';
}
export function publicKeyFingerprint(pemOrKey){
 const key=createPublicKey(pemOrKey);
 return createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');
}
export function pinnedKeyMatches(pem){
 return publicKeyFingerprint(pem)===PUBLIC_FINGERPRINT;
}
function parseBase64(value,maxBytes=8192){
 if(typeof value!=='string'||value.length>maxBytes*2||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
  rejected('Codificação de assinatura inválida.');
 const decoded=Buffer.from(value,'base64');
 if(decoded.length>maxBytes||decoded.toString('base64')!==value)rejected('Base64 não canônico.');
 return decoded;
}
export function validateReleaseMetadata(release,installedVersion){
 if(release?.schema!==1||release.channel!=='stable'||release.appId!==APP_ID)
  rejected('Identificação de aplicativo ou canal não autorizada.');
 if(!validVersion(release.version)||release.tag!=='v'+release.version)
  rejected('Versão de release fora do formato permitido.');
 if(!versionIsNewer(release.version,installedVersion))rejected('Não há nova versão superior à instalada.');
 const asset=release.asset;
 const name='INFINITUM-KillaAI-Setup-'+release.version+'-x64.exe';
 if(!asset||asset.name!==name||asset.url!==releaseArtifactUrl(release.version))
  rejected('Origem GitHub da atualização não autorizada.');
 if(!Number.isSafeInteger(asset.size)||asset.size<1000000||asset.size>500000000)
  rejected('Tamanho de atualização fora do limite permitido.');
 const hash=parseBase64(asset.sha512,64);
 if(hash.length!==64)rejected('Hash SHA-512 de atualização inválido.');
 return Object.freeze({version:release.version,tag:release.tag,
  asset:Object.freeze({name,url:asset.url,size:asset.size,sha512:asset.sha512})});
}
export function verifyUpdateManifest(document,publicKey,installedVersion){
 if(!document||document.format!=='w1-signed-release-v1')rejected('Formato de atualização não autorizado.');
 if(!pinnedKeyMatches(publicKey))rejected('Chave pública não pertence à W1 Capital.');
 const data=parseBase64(document.payload,4096);
 const sig=parseBase64(document.signature,64);
 if(sig.length!==64||verify(null,data,createPublicKey(publicKey),sig)!==true)
  rejected('Assinatura da W1 Capital inválida ou alterada.');
 let release;
 try{release=JSON.parse(data.toString('utf8'))}catch{rejected('Manifesto de atualização inválido.')}
 const meta=validateReleaseMetadata(release,installedVersion);
 return Object.freeze({...meta,payload:document.payload,signature:document.signature});
}
export function trustedHttpsUrl(value){
 try{const u=new URL(value);
  return u.protocol==='https:'&&u.username===''&&u.password===''&&
    ALLOWED_RELEASE_HOSTS.has(u.hostname)&&u.port==='';
 }catch{return false}
}
