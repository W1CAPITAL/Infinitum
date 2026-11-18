import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('botão Esqueceu a senha fecha apenas o elemento React, sem chave sobrando',()=>{
 const source=readFileSync(new URL('../components/secured-workspace.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/>Esqueceu a senha\?<\/button>\}\<\/div>/);
 assert.match(source,/onClick=\{\(\)=>setModeTo\('recover'\)\}/);
});