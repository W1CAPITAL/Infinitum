import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('INFINITUM starts with immediate local drafts and keeps Colibri/Qwen optional',()=>{
 const ui=read('components/openbot-workbench.jsx');
 assert.match(ui,/\[engine,setEngine\]=useState\('deterministico'\)/);
 assert.match(ui,/\[consent,setConsent\]=useState\(false\)/);
 assert.match(ui,/planColibriLocal/);
 assert.match(ui,/value="colibri-local"/);
 assert.match(ui,/maxTokens:tokenBudget/);
 assert.match(ui,/stopBlackholeQwen/);
 assert.match(ui,/createLegalTimelineSvg/);
 assert.match(ui,/createLegalDocumentHtml/);
 assert.match(read('lib/blackhole-local-llm.mjs'),/maxTokens\s*:/);
});
