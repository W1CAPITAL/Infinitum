import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('automatic updates are exclusively published by signed Windows workflow',()=>{
 const file=read('.github/workflows/killa-desktop-signed-release.yml');
 assert.match(file,/KILLA_WINDOWS_CERT_P12/);
 assert.match(file,/KILLA_WINDOWS_CERT_PASSWORD/);
 assert.match(file,/run: npm --prefix desktop run dist:win/);
 assert.match(file,/verify-windows-signature\.ps1/);
 assert.match(file,/gh release create/);
 assert.ok(file.indexOf('verify-windows-signature.ps1')<file.indexOf('gh release create'));
 assert.match(read('desktop/package.json'),/publish never/);
 assert.match(file,/github/i);
 const prep=read('desktop/prepare-signed-release.mjs');
 assert.match(prep,/signed-updates\.json/);
 assert.match(prep,/verifyUpdateCodeSignature=true/);
 assert.match(read('desktop/signed-updates.json'),/"enabled": false/);
});
