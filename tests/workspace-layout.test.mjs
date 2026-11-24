import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {groupWorkQueue} from '../lib/workspace-layout.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('fila agrupa por situação real, sem perder registros ou confundir datas',()=>{
 const rows=[{id:1,status:'vencido',due_on:'2026-11-23'},{id:2,status:'atencao',due_on:'2026-11-24'},{id:3,status:'em_dia',due_on:'2026-11-25'},{id:4,status:'sem_data'},{id:5,status:'encerrado',due_on:'2026-11-24'},{id:6,status:'atendido',due_on:'2026-11-23'}];
 assert.deepEqual(groupWorkQueue(rows,'2026-11-24').map(g=>[g.key,g.items.map(x=>x.id)]),[['overdue',[1]],['today',[2]],['upcoming',[3]],['undated',[4]],['done',[5,6]]]);
});
test('redesign uses distinct work surfaces, not only sidebar styles',()=>{
 const p=read('components/lexis-shared-office.jsx'),q=read('components/lexis-operations.jsx'),d=read('components/office-document-workspace.jsx'),h=read('components/lexis-dashboard.jsx');
 assert.match(p,/className="inf-portfolio-table"/);assert.match(p,/aria-label="Ações do processo"/);assert.match(q,/groupWorkQueue\(pageRows/);assert.match(q,/className="inf-queue-section"/);
 assert.match(d,/className="inf-document-studio"/);assert.match(d,/className="inf-document-library"/);assert.match(h,/className="inf-priority-board"/);
});
