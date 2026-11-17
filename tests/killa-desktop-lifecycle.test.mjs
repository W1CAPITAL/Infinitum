import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {secondInstanceAction,canReuseLocalServer} from '../desktop/lifecycle-policy.mjs';

test('second instance focuses the CRM when its window still exists',()=>{
 assert.equal(secondInstanceAction({crmOpen:true,launcherOpen:false}),'focus-crm');
});

test('second instance focuses the launcher when the CRM is closed but launcher remains',()=>{
 assert.equal(secondInstanceAction({crmOpen:false,launcherOpen:true}),'focus-launcher');
});

test('second instance restores the launcher when only the independent ZapFast window remains',()=>{
 assert.equal(secondInstanceAction({crmOpen:false,launcherOpen:false,zapFastOpen:true}),'open-launcher');
});

test('local Next server can be reused only with a live process and its valid private endpoint identity',()=>{
 assert.equal(canReuseLocalServer({processAlive:true,port:54193,nonce:'a'.repeat(48)}),true);
 assert.equal(canReuseLocalServer({processAlive:false,port:54193,nonce:'a'.repeat(48)}),false);
 assert.equal(canReuseLocalServer({processAlive:true,port:80,nonce:'a'.repeat(48)}),false);
 assert.equal(canReuseLocalServer({processAlive:true,port:54193,nonce:''}),false);
});

test('Electron wires second-instance recovery and authenticated local-server reuse',()=>{
 const main=readFileSync(new URL('../desktop/main.mjs',import.meta.url),'utf8');
 assert.match(main,/secondInstanceAction/);
 assert.match(main,/canReuseLocalServer/);
 assert.match(main,/localNextIsReady/);
 assert.match(main,/openLauncherWindow\(\)/);
});

test('Electron installer includes the lifecycle module imported by its main process',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../desktop/package.json',import.meta.url),'utf8'));
 assert.ok(pkg.build.files.includes('lifecycle-policy.mjs'));
});
