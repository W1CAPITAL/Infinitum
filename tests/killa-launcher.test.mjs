import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateLauncherAction,normalizeUpdateProgress,safeLauncherSnapshot,canInstallSignedUpdate} from '../desktop/launcher-policy.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('only supported launcher operations are dispatched',()=>{
 assert.equal(validateLauncherAction('launch'),true);
 assert.equal(validateLauncherAction('check-update'),true);
 assert.equal(validateLauncherAction('install-update'),true);
 assert.equal(validateLauncherAction('open-downloads'),true);
 assert.equal(validateLauncherAction('execute-shell'),false);
 assert.equal(validateLauncherAction('../local-file'),false);
});
test('progress and version are bounded for untrusted update metadata',()=>{
 assert.equal(normalizeUpdateProgress({percent:72.48}),72);
 assert.equal(normalizeUpdateProgress({percent:-4}),0);
 assert.equal(normalizeUpdateProgress({percent:900}),100);
 assert.equal(normalizeUpdateProgress({percent:'NaN'}),0);
 const status=safeLauncherSnapshot({phase:'ready',version:'1.2.3',updateVersion:'2.0.0',
  percent:7,token:'secret',error:'<script>alert(1)</script>'});
 assert.equal(status.token,undefined);
 assert.equal(status.error,undefined);
 assert.equal(status.updateVersion,'2.0.0');
});
test('installer refuses unsigned and non-downloaded updates',()=>{
 assert.equal(canInstallSignedUpdate({signed:true,downloaded:true,phase:'downloaded'}),true);
 assert.equal(canInstallSignedUpdate({signed:false,downloaded:true,phase:'downloaded'}),false);
 assert.equal(canInstallSignedUpdate({signed:true,downloaded:false,phase:'available'}),false);
 assert.equal(canInstallSignedUpdate({signed:true,downloaded:true,phase:'error'}),false);
});
test('launcher starts locally before Supabase, uses sandboxed IPC and no remote JS',()=>{
 const main=read('desktop/main.mjs');
 assert.match(main,/openLauncherWindow/);
 assert.match(main,/loadFile/);
 assert.match(main,/launcher:check-update/);
 assert.match(main,/launcher:launch/);
 assert.match(main,/launcher:install-update/);
 assert.match(main,/isTrustedLauncherEvent/);
 const preload=read('desktop/launcher-preload.cjs');
 assert.match(preload,/contextBridge\.exposeInMainWorld/);
 assert.doesNotMatch(preload,/exec\(|eval\(|shell\.openExternal|ipcRenderer\.sendSync/);
 const html=read('desktop/launcher.html');
 assert.match(html,/Content-Security-Policy/);
 assert.match(html,/Atualiza/);
 assert.doesNotMatch(html,/<script[^>]+src=["']https?:/);
 const pkg=JSON.parse(read('desktop/package.json'));
 assert.ok(pkg.build.files.includes('launcher.html'));
 assert.ok(pkg.build.files.includes('launcher-preload.cjs'));
});
test('only signed release workflow can distribute automatic updates, independent of Vercel',()=>{
 const workflow=read('.github/workflows/killa-desktop-signed-release.yml');
 assert.match(workflow,/desktop-production/);
 assert.match(workflow,/refs\/heads\/main/);
 assert.match(workflow,/KILLA_WINDOWS_CERT_P12/);
 assert.match(workflow,/KILLA_WINDOWS_CERT_PASSWORD/);
 assert.match(workflow,/forceCodeSigning/);
 assert.match(read('desktop/prepare-signed-release.mjs'),/forceCodeSigning=true/);
 assert.doesNotMatch(workflow,/vercel\s+(deploy|build)/i);
 const pkg=JSON.parse(read('desktop/package.json'));
 assert.equal(pkg.build.win.verifyUpdateCodeSignature,true);
 assert.equal(JSON.parse(read('desktop/signed-updates.json')).enabled,false);
 const docs=read('desktop/README.md');
 assert.match(docs,/launcher|iniciador/i);
 assert.match(docs,/GitHub Releases/);
});

test('a modified marker alone cannot enable updating without publisher signature metadata',async()=>{
 const {isSignedUpdateConfiguration}=await import('../desktop/launcher-policy.mjs');
 assert.equal(isSignedUpdateConfiguration({enabled:true,source:'signed-github-release'},''),false);
 assert.equal(isSignedUpdateConfiguration({enabled:true,source:'signed-github-release'},'verifyUpdateCodeSignature: false\npublisherName: CN=Evil'),false);
 assert.equal(isSignedUpdateConfiguration({enabled:true,source:'signed-github-release'},'publisherName: CN=W1 Capital'),true);
});
