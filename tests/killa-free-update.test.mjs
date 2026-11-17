import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPublicKey,verify} from 'node:crypto';
import {
 verifyUpdateManifest,validateReleaseMetadata,versionIsNewer,releaseArtifactUrl,
 publicKeyFingerprint
} from '../desktop/release-trust.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const payload=(version='1.2.3')=>({
 schema:1,channel:'stable',appId:'br.com.w1capital.infinitum.killa',
 version,tag:'v'+version,
 asset:{name:'INFINITUM-KillaAI-Setup-'+version+'-x64.exe',
  url:'https://github.com/W1CAPITAL/Infinitum/releases/download/v'+version+'/INFINITUM-KillaAI-Setup-'+version+'-x64.exe',
  size:1000000,sha512:Buffer.alloc(64,7).toString('base64') }
});
test('free signed manifest rejects tampering, downgrade and unsigned main ZIP',()=>{
 const pub=read('desktop/branding/update-public-key.pem');
 const doc=JSON.parse(read('tests/fixtures/killa-signed-release.json'));
 // The historic fixture is legitimately signed but uses the retired repository,
 // so signature validity alone must NOT permit importing it as an update.
 const signedPayload=Buffer.from(doc.payload,'base64');
 const signedSignature=Buffer.from(doc.signature,'base64');
 assert.equal(verify(null,signedPayload,createPublicKey(pub),signedSignature),true);
 assert.throws(()=>verifyUpdateManifest(doc,pub,'1.0.0'),/origem GitHub/i);
 assert.equal(validateReleaseMetadata(payload(),'1.0.0').version,'1.2.3');
 assert.throws(()=>verifyUpdateManifest({...doc,signature:Buffer.alloc(64).toString('base64')},pub,'1.0.0'),/assinatura|signature/i);
 assert.throws(()=>verifyUpdateManifest({...doc,payload:Buffer.from('tampered').toString('base64')},pub,'1.0.0'),/assinatura|signature/i);
 assert.throws(()=>verifyUpdateManifest(doc,pub,'1.2.3'),/nova versão|newer/i);
 const external=payload();external.asset.url='https://evil.invalid/exe';
 assert.throws(()=>validateReleaseMetadata(external,'1.0.0'),/origem|URL|GitHub/i);
 assert.equal(versionIsNewer('1.0.1','1.0.0'),true);
 assert.equal(versionIsNewer('0.9.9','1.0.0'),false);
 assert.equal(releaseArtifactUrl('1.2.3'),payload().asset.url);
 assert.match(publicKeyFingerprint(pub),/^[a-f0-9]{64}$/);
});

test('brand assets: W1 Capital actual logo and original INFINITUM infinity (not Ethereum)',()=>{
 const html=read('desktop/launcher.html');
 assert.match(html,/branding\/w1-wordmark\.svg/);
 assert.match(html,/branding\/infinitum-symbol\.svg/);
 assert.doesNotMatch(html,/ethereum|etherum/i);
 const w1=read('desktop/branding/w1-wordmark.svg');
 assert.match(w1,/W1 CAPITAL/);
 const inf=read('desktop/branding/infinitum-symbol.svg');
 assert.match(inf,/viewBox="0 0 205 94"/);
 assert.doesNotMatch(inf,/ethereum|etherum/i);
 const pkg=JSON.parse(read('desktop/package.json'));
 assert.ok(pkg.build.files.includes('branding/**/*'));
 assert.match(pkg.build.win.icon,/infinitum-app\.ico/);
});
test('free release distribution requires manual approval, private signing secret, no main ZIP execution',()=>{
 const ci=read('.github/workflows/killa-desktop-free-release.yml');
 assert.match(ci,/workflow_dispatch/);
 assert.match(ci,/desktop-production/);
 assert.match(ci,/refs\/heads\/main/);
 assert.match(ci,/KILLA_ED25519_PRIVATE_KEY_B64/);
 assert.match(ci,/gh release create/);
 assert.doesNotMatch(ci,/vercel|git archive|main\.zip|\/archive\/refs\/heads\/main/i);
 const signed=read('desktop/sign-free-release.mjs');
 assert.match(signed,/createPrivateKey|sign\(/);
 assert.match(signed,/publicKeyFingerprint/);
 assert.doesNotMatch(signed,/BEGIN PRIVATE KEY[\\s\\S]*END PRIVATE KEY/);
 const update=read('desktop/free-update-client.mjs');
 assert.match(update,/verifyUpdateManifest/);
 assert.ok(update.includes("createHash('sha512')"));
 assert.ok(update.includes("getPath('userData')"));
 assert.doesNotMatch(update,/execSync|eval\(|https:\/\/.*vercel/);
});

test('packaged Electron includes the entire signed update verifier and its pinned public key',()=>{
 const pkg=JSON.parse(read('desktop/package.json'));
 for(const path of ['main.mjs','free-update-client.mjs','release-trust.mjs','branding/**/*']){
  assert.ok(pkg.build.files.includes(path),'Ausente do EXE: '+path);
 }
 assert.match(read('desktop/free-update-client.mjs'),/pinnedKeyMatches/);
 assert.match(read('desktop/branding/update-public-key.pem'),/BEGIN PUBLIC KEY/);
});
