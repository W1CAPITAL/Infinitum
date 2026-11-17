import {createPrivateKey,createPublicKey,sign,createHash} from 'node:crypto';
import {createReadStream,readFileSync,writeFileSync,statSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {publicKeyFingerprint,validVersion,releaseArtifactUrl} from './release-trust.mjs';
const version=String(process.argv[2]||'');
const file=String(process.argv[3]||'');
if(!validVersion(version)||!file)throw Error('Informe a versão e o caminho do EXE aprovado.');
const dest=resolve(file),name=basename(dest);
const expected='INFINITUM-KillaAI-Setup-'+version+'-x64.exe';
if(name!==expected)throw Error('Nome do instalador não corresponde à versão aprovada.');
if(!process.env.KILLA_ED25519_PRIVATE_KEY_B64)throw Error('Chave de release ausente.');
const data=Buffer.from(process.env.KILLA_ED25519_PRIVATE_KEY_B64,'base64');
const key=createPrivateKey(data);
if(key.asymmetricKeyType!=='ed25519')throw Error('Chave Ed25519 obrigatória.');
const trusted=readFileSync(join(import.meta.dirname,'branding','update-public-key.pem'),'utf8');
if(publicKeyFingerprint(createPublicKey(key))!==publicKeyFingerprint(trusted))
 throw Error('Chave de assinatura não corresponde à identidade pública do launcher.');
const stats=statSync(dest);
if(!stats.isFile()||stats.size<1000000||stats.size>500000000)
 throw Error('Tamanho de pacote inesperado; publicação cancelada.');
const hash=createHash('sha512');
for await(const chunk of createReadStream(dest))hash.update(chunk);
const body={schema:1,channel:'stable',appId:'br.com.w1capital.infinitum.killa',
 version,tag:'v'+version,
 asset:{name,url:releaseArtifactUrl(version),size:stats.size,sha512:hash.digest('base64')}};
const bytes=Buffer.from(JSON.stringify(body),'utf8');
const manifest={format:'w1-signed-release-v1',
 payload:bytes.toString('base64'),
 signature:sign(null,bytes,key).toString('base64')};
const output=join(import.meta.dirname,'dist','killa-update.json');
writeFileSync(output,JSON.stringify(manifest,null,2)+'\n');
console.log('Manifesto Ed25519 válido preparado para upload à release oficial; fingerprint verificado.');
