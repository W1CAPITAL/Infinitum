import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createPrivateKey,createPublicKey} from 'node:crypto';
import {publicKeyFingerprint,validVersion} from './release-trust.mjs';
const version=String(process.argv[2]||'');
if(!validVersion(version))throw Error('Versão estável x.y.z obrigatória.');
if(!process.env.KILLA_ED25519_PRIVATE_KEY_B64)throw Error('Segredo Ed25519 não configurado no ambiente desktop-production.');
const privateBytes=Buffer.from(process.env.KILLA_ED25519_PRIVATE_KEY_B64,'base64');
if(privateBytes.length<110||privateBytes.length>8192)throw Error('Chave de assinatura privada inválida.');
const key=createPrivateKey(privateBytes);
if(key.asymmetricKeyType!=='ed25519')throw Error('Assinatura exige Ed25519.');
const dir=resolve(import.meta.dirname);
const publicKey=readFileSync(join(dir,'branding','update-public-key.pem'),'utf8');
if(publicKeyFingerprint(createPublicKey(key))!==publicKeyFingerprint(publicKey))
 throw Error('A chave privada não corresponde à chave pública embutida no launcher. Cancelando a publicação.');
const manifestPath=join(dir,'package.json');
const pkg=JSON.parse(readFileSync(manifestPath,'utf8'));
pkg.version=version;
delete pkg.build.publish;
pkg.build.win.verifyUpdateCodeSignature=true; // Windows validates the publisher independently of Ed25519 updates.
pkg.build.forceCodeSigning=true; // Ed25519 alone does not satisfy Windows SmartScreen/Authenticode.
writeFileSync(manifestPath,JSON.stringify(pkg,null,2)+'\n');
writeFileSync(join(dir,'signed-updates.json'),JSON.stringify({
 enabled:true,source:'w1-ed25519-github-release',version,channel:'stable'
},null,2)+'\n');
console.log('Canal gratuito Ed25519 habilitado para versão '+version+'. Segredo não incluído no EXE.');
