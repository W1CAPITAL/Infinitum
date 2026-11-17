import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {DESKTOP_ENTRY_PATH} from '../desktop/runtime-policy.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('desktop login must open an existing Next route rather than absent /login',()=>{
 assert.equal(DESKTOP_ENTRY_PATH,'/');
 assert.ok(existsSync(new URL('../app/page.jsx',import.meta.url)));
 assert.equal(existsSync(new URL('../app/login/page.jsx',import.meta.url)),false);
 const main=read('desktop/main.mjs');
 assert.match(main,/launchLocalCRM\(DESKTOP_ENTRY_PATH\)/);
 assert.match(main,/async function launchLocalCRM\(target=DESKTOP_ENTRY_PATH\)/);
 assert.match(main,/async function openAppWindow\(target=DESKTOP_ENTRY_PATH\)/);
 assert.doesNotMatch(main,/launchLocalCRM\(['"]\/login['"]\)/);
 assert.doesNotMatch(main,/loadURL\(['"]https?:\/\/[^'"]*vercel/);
 assert.doesNotMatch(read('app/app-store/admin/page.jsx'),/href=["']\/login["']/);
});

test('pre-build and packaged smoke tests verify a real app HTML page, not just server health',()=>{
 for(const path of ['desktop/verify-local-server.mjs','desktop/verify-packaged-server.mjs']){
  const code=read(path);
  assert.match(code,/DESKTOP_ENTRY_PATH/);
  assert.match(code,/text\/html/);
  assert.match(code,/response\.status\s*!==\s*200|result\.status\s*!==\s*200/);
  assert.match(code,/redirect:\s*['"]manual['"]/);
 }
});

test('test Windows artifact remains explicitly unsigned and public releases require Authenticode',()=>{
 const ci=read('.github/workflows/killa-desktop-windows.yml');
 assert.match(ci,/infinitum-killa-windows-test-UNSIGNED/);
 const signed=read('.github/workflows/killa-desktop-signed-release.yml');
 assert.match(signed,/verify-windows-signature\.ps1/);
 assert.match(signed,/forceCodeSigning/);
});
