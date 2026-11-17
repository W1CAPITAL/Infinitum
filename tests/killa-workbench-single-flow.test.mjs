import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tryArithmetic} from '../lib/blackhole-arithmetic.mjs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Killa renders only one prompt and one engine selector',()=>{
 const s=source('components/openbot-workbench.jsx');
 assert.equal((s.match(/id="killa-input"/g)||[]).length,1);
 assert.equal((s.match(/aria-label="Motor da resposta"/g)||[]).length,1);
 assert.equal((s.match(/Motor de inteligência/g)||[]).length,0);
 assert.equal((s.match(/Pedido para os agentes/g)||[]).length,0);
 assert.equal((s.match(/Gerar rascunho para revisão/g)||[]).length,0);
});
test('Killa shows Qwen permission next to selector and keeps one result and status',()=>{
 const s=source('components/openbot-workbench.jsx');
 assert.match(s,/localSelected&&<label className=\{ui\.quickConsent\}/);
 assert.match(s,/checked=\{consent\}/);
 assert.match(s,/\{notice&&<p role="status"/);
 assert.equal((s.match(/className=\{ui\.answer\}/g)||[]).length,1);
 assert.match(s,/stopBlackholeQwen/);
});
test('calculator recognizes multiplication written as X without external AI',()=>{
 assert.equal(tryArithmetic('QUANTO É 59X9'),'59 × 9 = 531');
 assert.equal(tryArithmetic('quanto é 59 x 9'),'59 × 9 = 531');
 assert.equal(tryArithmetic('2x3+4'),'2 × 3 + 4 = 10');
 assert.equal(tryArithmetic('1x alert(1)'),null);
});
