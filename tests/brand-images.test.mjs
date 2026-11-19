import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('o símbolo INFINITUM vem de imagem no menu, no login e nos agentes',()=>{
 for(const file of ['components/crm-shell.jsx','components/professional-auth.jsx','components/agents-command-center.jsx','app/superagente/page.jsx']){
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.doesNotMatch(source,/>∞[ <]/,file);
  assert.match(source,/\/branding\/infinitum-symbol-/,file);
 }
});
