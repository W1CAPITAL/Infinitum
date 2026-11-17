import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('launcher does not exit before Ed25519-verified automatic install starts',()=>{
 const main=read('desktop/main.mjs');
 assert.match(main,/window-all-closed/);
 assert.match(main,/applyVerifiedUpdate\(\)\.finally\(\(\)=>app\.quit\(\)\)/);
 const free=read('desktop/free-update-client.mjs');
 assert.match(free,/child\.once\('spawn',resolve\)/);
 assert.match(free,/child\.once\('error',reject\)/);
});
