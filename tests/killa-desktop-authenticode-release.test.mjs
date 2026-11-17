import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const signed=read('.github/workflows/killa-desktop-signed-release.yml');
const free=read('.github/workflows/killa-desktop-free-release.yml');
const check=read('desktop/verify-windows-signature.ps1');

test('a public Windows release fails if Authenticode is missing or untrusted',()=>{
 assert.match(check,/Get-AuthenticodeSignature -LiteralPath/);
 assert.match(check,/SignatureStatus]::Valid/);
 assert.match(check,/1\.3\.6\.1\.5\.5\.7\.3\.3/);
 assert.match(check,/SignerCertificate\.Thumbprint/);
 for(const workflow of [signed,free]){
  assert.match(workflow,/KILLA_WINDOWS_CERT_P12/);
  assert.match(workflow,/KILLA_WINDOWS_CERT_PASSWORD/);
  assert.match(workflow,/verify-windows-signature\.ps1/);
  assert.match(workflow,/WIN_CSC_LINK:/);
  assert.match(workflow,/WIN_CSC_KEY_PASSWORD:/);
  assert.ok(workflow.indexOf('verify-windows-signature.ps1')<workflow.indexOf('gh release create'),
   'Signature verification must precede upload to public GitHub Release');
 }
});
test('both public release channels refuse unsigned installer publication',()=>{
 assert.match(read('desktop/prepare-signed-release.mjs'),/forceCodeSigning=true/);
 assert.match(read('desktop/prepare-free-release.mjs'),/forceCodeSigning=true/);
 assert.doesNotMatch(signed,/run: npm --prefix desktop run dist:release/);
 assert.match(signed,/run: npm --prefix desktop run dist:win/);
 assert.match(signed,/desktop\/dist\/latest\.yml/);
 assert.match(free,/sign-free-release\.mjs/);
 assert.ok(free.indexOf('verify-windows-signature.ps1')<free.indexOf('sign-free-release.mjs'));
});
test('CI-only unsigned Windows build is clearly marked as test artifact',()=>{
 const ci=read('.github/workflows/killa-desktop-windows.yml');
 assert.match(ci,/infinitum-killa-windows-test-UNSIGNED/);
 assert.doesNotMatch(ci,/name: infinitum-killa-windows-installer\n/);
});
