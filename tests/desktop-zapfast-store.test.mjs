import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {isSafeZapFastNavigation,DESKTOP_ZAPFAST_URL} from '../desktop/runtime-policy.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('desktop ZapFast navigation is pinned to its exact HTTPS origin',()=>{
 assert.equal(DESKTOP_ZAPFAST_URL,'https://zapfast-cloudflare-web.daviconcentrix.workers.dev/');
 assert.equal(isSafeZapFastNavigation(DESKTOP_ZAPFAST_URL),true);
 assert.equal(isSafeZapFastNavigation(DESKTOP_ZAPFAST_URL+'trocar-numero'),true);
 for(const other of ['http://zapfast-cloudflare-web.daviconcentrix.workers.dev/',
   'https://zapfast-cloudflare-web.daviconcentrix.workers.dev.attacker.invalid/',
   'https://foo.daviconcentrix.workers.dev/',
   'file:///C:/Windows/system.ini',
   'https://user:password@zapfast-cloudflare-web.daviconcentrix.workers.dev/',
   'https://zapfast-cloudflare-web.daviconcentrix.workers.dev:444/']){
  assert.equal(isSafeZapFastNavigation(other),false,other);
 }
});

test('launcher opens ZapFast in a sandboxed, separate Electron window without a second QR in the CRM',()=>{
 const main=read('desktop/main.mjs');
 assert.match(main,/async function openZapFastWindow\(/);
 assert.match(main,/isSafeZapFastNavigation\(/);
 assert.match(main,/partition:\s*'persist:w1-zapfast'/);
 assert.match(main,/contextIsolation:true,nodeIntegration:false,sandbox:true/);
 assert.match(main,/launcher:open-zapfast/);
 assert.match(main,/killa:open-zapfast/);
 assert.match(main,/isTrustedDesktopEvent/);
 assert.match(read('desktop/launcher-preload.cjs'),/openZapFast:/);
 assert.match(read('desktop/preload.cjs'),/openZapFast:/);
 const launcher=read('desktop/launcher.html');
 assert.match(launcher,/id="zapfast"/);
 assert.match(launcher,/Killa AI Store/);
 assert.match(read('desktop/launcher-ui.js'),/openZapFast/);
});

test('Killa AI Store includes an authenticated CRM catalog and keeps admin restricted',()=>{
 assert.ok(existsSync(new URL('../app/app-store/page.jsx',import.meta.url)));
 const store=read('app/app-store/page.jsx');
 assert.match(store,/SecuredWorkspace/);
 assert.match(store,/INFINITUM/);
 assert.match(store,/ZapFast/);
 assert.match(store,/app-store\/admin/);
 const ui=read('components/wa-auto-inbox.jsx');
 assert.match(ui,/killaDesktop\?\.openZapFast/);
 assert.match(ui,/ZAPFAST_SINGLE_SESSION_URL/);
 assert.match(read('desktop/verify-local-server.mjs'),/['"]\/app-store['"]/);
 assert.match(read('desktop/verify-packaged-server.mjs'),/['"]\/app-store['"]/);
});
