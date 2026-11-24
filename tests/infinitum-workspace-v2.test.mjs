import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CRM_AREAS,CRM_NAV_GROUPS,searchCrmAreas} from '../lib/crm-navigation.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('every real route belongs to exactly one clear navigation group',()=>{
 const keys=CRM_NAV_GROUPS.flatMap(g=>g.items.map(x=>x.key));
 assert.equal(new Set(keys).size,CRM_AREAS.length);
 assert.deepEqual([...keys].sort(),CRM_AREAS.map(x=>x.key).sort());
 assert.ok(CRM_NAV_GROUPS.every(g=>g.label&&g.items.every(i=>i.description)));
 assert.equal(searchCrmAreas('cliente')[0].path,'/processos');
 assert.ok(searchCrmAreas('petição').some(x=>x.path==='/pecas'));
 assert.ok(searchCrmAreas('prazo').some(x=>x.path==='/agenda'));
});
test('shared shell uses grouped navigation, pin and functional route descriptions',()=>{
 const shell=read('components/crm-shell.jsx');
 assert.match(shell,/CRM_NAV_GROUPS\.map/);
 assert.match(shell,/sidebarPinned/);
 assert.match(shell,/inf-nav-description/);
 assert.match(shell,/searchCrmAreas\(navSearch\)/);
 assert.match(shell,/inf-workspace-v2/);
 const css=read('app/infinitum-workspace-v2.css');
 assert.match(css,/\[data-crm-mode="dark"\]/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/focus-visible/);
 assert.ok(read('app/layout.jsx').indexOf("import './infinitum-workspace-v2.css'")>read('app/layout.jsx').indexOf("import './infinitum-dual-themes.css'"));
});
