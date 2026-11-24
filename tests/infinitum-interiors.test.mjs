import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('interiors have distinct task-oriented compositions without replacing the approved sidebar',()=>{
 const d=read('components/lexis-dashboard.jsx'),p=read('components/lexis-shared-office.jsx'),o=read('components/lexis-operations.jsx'),s=read('app/configuracoes/page.jsx'),l=read('app/leads/page.jsx');
 assert.match(d,/inf-home-command-grid/);assert.match(d,/inf-home-focus/);
 assert.match(p,/inf-portfolio-desk/);assert.match(p,/inf-portfolio-controls/);
 assert.match(o,/inf-operation-desk/);assert.match(o,/inf-operation-controls/);
 assert.match(s,/inf-settings-nav/);assert.match(s,/settingsSection/);
 assert.match(l,/inf-leads-tabs/);assert.match(l,/leadWorkspace/);
 const css=read('app/infinitum-interiors.css');
 assert.match(css,/\.inf-studio-frame/);assert.doesNotMatch(css,/\.app-sidebar|\.inf-category-rail/);
 assert.match(css,/data-crm-mode="dark"/);assert.match(css,/prefers-reduced-motion/);
 assert.ok(read('app/layout.jsx').indexOf("import './infinitum-interiors.css'")>read('app/layout.jsx').indexOf("import './infinitum-studio-chrome.css'"));
});
