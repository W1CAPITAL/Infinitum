import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {isNavGroupOpen} from '../lib/crm-navigation.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('group containing current route stays accessible; remaining sections are user-controlled',()=>{
 assert.equal(isNavGroupOpen('Rotina de trabalho','processos',['Rotina de trabalho']),true);
 assert.equal(isNavGroupOpen('Administração','processos',['Administração']),false);
 assert.equal(isNavGroupOpen('Administração','processos',[]),true);
 assert.equal(isNavGroupOpen('Visão geral','relatorios',['Visão geral']),true);
});
test('signature layout preserves navigation, introduces actual branded chrome and scoped background layers',()=>{
 const shell=read('components/crm-shell.jsx'),css=read('app/infinitum-signature.css'),layout=read('app/layout.jsx');
 assert.match(shell,/inf-signature-shell/);assert.match(shell,/inf-nav-group-toggle/);assert.match(shell,/aria-expanded=\{groupOpen\}/);
 assert.match(shell,/inf-signature-context/);assert.match(shell,/inf-signature-profile/);assert.match(shell,/CRM_NAV_GROUPS\.map/);
 assert.match(css,/\.inf-signature-shell .*\.app-sidebar/);assert.match(css,/\.app-content\[data-route\]/);assert.match(css,/radial-gradient/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/@media\(max-width:880px\)/);
 assert.ok(layout.indexOf("import './infinitum-signature.css'")>layout.indexOf("import './infinitum-solid-backgrounds.css'"));
});
