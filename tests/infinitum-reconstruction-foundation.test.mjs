import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchCompanyRows} from '../lib/lexis-company-data.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fake(rows){let calls=0;const db={from(){return {select(){return this},eq(){return this},order(){return this},async range(a,b){calls++;return {data:rows.slice(a,b+1),error:null}}}}};return {db,calls:()=>calls}}
test('company loader accepts exactly the safety limit and refuses truncated totals',async()=>{const a=fake([1,2,3,4]);assert.deepEqual(await fetchCompanyRows(a.db,'t','id','e',{pageSize:2,maxRows:4}),[1,2,3,4]);const b=fake([1,2,3,4,5]);await assert.rejects(fetchCompanyRows(b.db,'t','id','e',{pageSize:2,maxRows:4}),/limite de segurança/)});
test('simultaneous identical company queries reuse in-flight work but a later read refreshes',async()=>{const a=fake([1,2,3]);const f=()=>fetchCompanyRows(a.db,'t','id','e',{pageSize:2,maxRows:4});assert.deepEqual(await Promise.all([f(),f()]),[[1,2,3],[1,2,3]]);assert.equal(a.calls(),2);await f();assert.equal(a.calls(),4)});
test('heavy model preparation is explicit and restricted to AI routes',()=>{const q=read('components/qwen-preinstall-bootstrap.jsx');assert.match(q,/infinitum\.qwen\.preinstall\.enabled/);assert.match(q,/pathname!==.\/agentes./)});
test('generator uses shared portfolio writer for manual and candidate registrations',()=>{const g=read('app/gerador-processos/page.jsx');assert.match(g,/return createPortfolioProcess/);assert.match(g,/await saveToCompany\(number,name/);assert.match(g,/await saveCandidate\(row/)});
test('WhatsApp filters current conversation before passing messages to the assistant',()=>{const w=read('components/wa-auto-inbox.jsx');assert.match(w,/activeJid\.current===jid/);assert.match(w,/messages=\{currentMessages\}/);assert.match(w,/currentMessages\.length\?currentMessages\.map/)});
