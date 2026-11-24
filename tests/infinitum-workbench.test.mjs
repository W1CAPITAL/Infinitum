import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('workbench has actual new page structures and not just theme overrides',()=>{
 const home=read('components/lexis-dashboard.jsx'),doc=read('components/office-document-workspace.jsx'),portfolio=read('components/lexis-shared-office.jsx'),ops=read('components/lexis-operations.jsx');
 assert.match(home,/workbench-home-hero/);assert.match(home,/workbench-home-nav/);assert.match(home,/homeView/);
 assert.match(doc,/workbench-document-steps/);assert.match(doc,/documentStep/);assert.match(doc,/workbench-paper/);
 assert.match(portfolio,/workbench-portfolio-segments/);assert.match(portfolio,/setActiveFilter/);
 assert.match(ops,/workbench-operation-nav/);assert.match(ops,/chooseFilter/);
 const css=read('app/infinitum-workbench.css');
 assert.doesNotMatch(css,/\.app-sidebar|\.inf-category-rail/);
 assert.match(css,/\.workbench-home-hero/);assert.match(css,/\.workbench-paper/);
 assert.match(css,/data-crm-mode="dark"/);assert.match(css,/prefers-reduced-motion/);
 assert.match(read('app/layout.jsx'),/import '\.\/infinitum-workbench\.css'/);
});
