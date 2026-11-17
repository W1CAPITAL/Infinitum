import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('W1 Capital Store opens in its own local sandbox instead of a CRM route',()=>{
 const main=read('desktop/main.mjs');
 assert.match(main,/async function openStoreWindow\(/);
 assert.match(main,/loadFile\(join\(app\.getAppPath\(\),'store\.html'\)\)/);
 assert.match(main,/return openStoreWindow\(\)/);
 assert.doesNotMatch(main,/launchLocalCRM\('\/app-store'\)/);
 assert.match(main,/function isTrustedStoreEvent/);
 assert.match(main,/store:launch-infinitum/);
 assert.match(main,/store:open-repo/);
 assert.match(main,/Object\.hasOwn\(known,product\)/);
 assert.doesNotMatch(main,/store:[^\n]*exec|shell:execute/);
});

test('store shows only an installed INFINITUM and does not pretend Lexis EXE exists',()=>{
 const html=read('desktop/store.html');
 assert.match(html,/INFINITUM/);
 assert.match(html,/LexisPredict/);
 assert.match(html,/EXE independente em preparação/);
 assert.match(html,/Nenhum dado de clientes/);
 assert.match(html,/Content-Security-Policy/);
 assert.doesNotMatch(html,/<script[^>]+src=["']https?:/);
 const preload=read('desktop/store-preload.cjs');
 assert.match(preload,/contextBridge\.exposeInMainWorld/);
 assert.doesNotMatch(preload,/exec\(|eval\(|shell\.openExternal/);
 const pkg=JSON.parse(read('desktop/package.json'));
 for(const f of ['store.html','store.css','store-ui.js','store-preload.cjs'])
  assert.ok(pkg.build.files.includes(f),'missing '+f);
});
