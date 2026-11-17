import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OPENBOT_COWORKERS} from '../lib/openbot-workspace-policy.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('OpenBot coworker catalog includes an explicitly authorized browser tab role, never a sender',()=>{
 const browser=OPENBOT_COWORKERS.find(c=>c.id==='navegador-local');
 assert.ok(browser);
 assert.equal(browser.canReadAuthorizedTab,true);
 assert.equal(browser.canSend,false);
 assert.equal(browser.canShareCaseData,false);
});
test('browser extension keeps only a bounded content-free local activity log',()=>{
 const background=read('browser-extension/infinitum-tab-bridge/background.js');
 assert.match(background,/auditAction/);
 assert.match(background,/slice\(-20\)/);
 assert.match(background,/chrome\.storage\.session/);
 assert.doesNotMatch(background,/auditAction\([^\n]*request\.text/);
 assert.doesNotMatch(background,/fetch\(.*api\//);
});
