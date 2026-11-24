import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {CRM_NAV_GROUPS,resolveWorkspaceGroup} from '../lib/crm-navigation.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('workspace category selection follows the route and resets stale selections',()=>{
 assert.equal(resolveWorkspaceGroup('/processos','processos',null),'Rotina de trabalho');
 assert.equal(resolveWorkspaceGroup('/processos','processos',{path:'/processos',label:'Inteligência jurídica'}),'Inteligência jurídica');
 assert.equal(resolveWorkspaceGroup('/agenda','agenda',{path:'/processos',label:'Inteligência jurídica'}),'Rotina de trabalho');
 assert.equal(resolveWorkspaceGroup('/report','relatorios',{path:'/report',label:'invalid'}),'Visão geral');
});
test('desktop rail preserves every navigation group and mobile menu',()=>{
 const s=read('components/crm-shell.jsx'),css=read('app/infinitum-studio-chrome.css');
 assert.match(s,/inf-category-rail/);assert.match(s,/resolveWorkspaceGroup/);assert.match(s,/inf-studio-frame/);assert.match(s,/crm-mobile-more/);assert.match(s,/aria-pressed=\{selectedGroup===group.label\}/);
 assert.match(css,/grid-template-columns/);assert.match(css,/\.inf-studio-frame/);assert.match(css,/data-crm-mode="dark"/);assert.match(css,/max-width:880px/);
 assert.equal(CRM_NAV_GROUPS.flatMap(g=>g.items).length,23);
});
