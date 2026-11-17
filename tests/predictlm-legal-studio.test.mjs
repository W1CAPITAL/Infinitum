import test from 'node:test';import assert from 'node:assert/strict';
import {buildPredictLmPetition,buildPredictLmLegalSectionPrompt,
 createLegalDocumentHtml,createLegalTimelineSvg} from '../lib/predictlm-legal-studio.mjs';
test('PredictLM-inspired legal draft builds a real structured petition, not generic instruction',()=>{
 const r=buildPredictLmPetition({kind:'manifestacao',instructions:'Pedir análise dos documentos anexados.'});
 assert.match(r.body,/AO JUÍZO|Processo nº/);
 assert.match(r.body,/MANIFESTA[CÇ][ÃA]O/i);
 assert.match(r.body,/revisão profissional|revis[aã]o obrigat[oó]ria/i);
 assert.match(r.body,/Pedir análise dos documentos anexados/);
 assert.ok(r.body.length>300);
 assert.equal(r.needsReview,true);
});
test('Qwen legal section prompt prevents fabricated law, deadlines and ungrounded facts',()=>{
 const text=buildPredictLmLegalSectionPrompt({kind:'contestacao',instructions:'A parte ré apresentou documentos em 12/11/2026.'});
 assert.match(text,/NUNCA invente/i);
 assert.match(text,/12\/11\/2026/);
 assert.match(text,/advogado|profissional/i);
 assert.doesNotMatch(text,/api\.predictlm/);
});
test('PredictLM local document formatter escapes markup without remote scripts',()=>{
 const html=createLegalDocumentHtml({title:'Manifestação <script>',body:'Oi <img src=x onerror=alert(1)>'});
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/&lt;img/);
 assert.doesNotMatch(html,/<script|<img/);
 assert.match(html,/<!doctype html>/i);
});
test('Local explanatory timeline generates a safe SVG without pretending to certify evidence',()=>{
 const svg=createLegalTimelineSvg({events:'12/11/2026 | Protocolo informado\n14/11/2026 | <script>alert(1)</script>'});
 assert.match(svg,/<svg/);
 assert.match(svg,/12\/11\/2026/);
 assert.match(svg,/n[aã]o verificad/i);
 assert.doesNotMatch(svg,/<script>/);
 assert.match(svg,/&lt;script&gt;/);
});
test('Timeline rejects invalid dates and keeps bounded data',()=>{
 assert.throws(()=>createLegalTimelineSvg({events:'41/12/2026 | Data falsa'}),/data/i);
 assert.throws(()=>createLegalTimelineSvg({events:'12/11/2026 | '.concat('a'.repeat(1000))}),/limite/i);
});
