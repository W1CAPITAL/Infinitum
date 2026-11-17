import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Windows desktop retains one loopback origin for auth and Qwen persistent cache',()=>{
 const main=read('desktop/main.mjs');
 assert.match(main,/killa-loopback-port\.json/);
 assert.match(main,/stablePrivatePort/);
 assert.match(main,/flag:'wx'/);
 assert.match(main,/KILLA_LOCAL_NONCE/);
 assert.match(main,/answer\?\.nonce===localNonce/);
 assert.doesNotMatch(main,/\/login'.*response\.status>/);
 const route=read('app/api/desktop/health/route.js');
 assert.match(route,/KILLA_LOCAL_NONCE/);
 assert.match(route,/ready:true/);
});
