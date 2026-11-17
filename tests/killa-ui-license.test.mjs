import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Killa chat is functional, not decorative',()=>{const x=read('components/openbot-workbench.jsx');assert.match(x,/killa-input/);assert.match(x,/onClick=\{generate\}/);assert.match(x,/setPrompt\(e\.target\.value\)/);assert.match(x,/\/mcp\/setup/);assert.match(read('components/killa-workbench.module.css'),/prefers-reduced-motion/);});
test('Future proprietary terms preserve already granted MIT rights',()=>{const x=read('LICENSE');assert.match(x,/PROPRIETÁRIO/);assert.match(x,/MIT/);assert.match(x,/RETROATIVAMENTE/);});
