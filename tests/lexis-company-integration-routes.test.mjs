import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('carteira carrega todos os processos da empresa e pagina somente no cliente',()=>{
 const page=source('components/lexis-shared-office.jsx');
 assert.match(page,/fetchCompanyRows\(db,'processos',PROCESS_FIELDS,profile\.empresa_id/);
 assert.match(page,/const visibleRows=filteredRows\.slice\(page\*PAGE/);
 assert.match(page,/visibleRows\.map\(p=>/);
 assert.doesNotMatch(page,/\.range\(page\*PAGE/);
});

test('tarefas e vencidos usam a fila empresarial Lexis quando a base compartilhada está ativa',()=>{
 const tasks=source('app/tarefas/page.jsx');
 const overdue=source('app/vencidos/page.jsx');
 const operations=source('components/lexis-operations.jsx');
 assert.match(tasks,/NEXT_PUBLIC_LEXIS_SHARED_DB==='1'/);
 assert.match(tasks,/<LexisOperations area="tasks"/);
 assert.match(overdue,/<LexisOperations area="overdue"/);
 assert.match(operations,/filterLexisCompanyQueue/);
 assert.match(operations,/crm_tarefas/);
});

test('conclusão de tarefa atualiza a linha original com escopo da empresa',()=>{
 const operations=source('components/lexis-operations.jsx');
 const details=source('components/lexis-event-details.jsx');
 assert.match(operations,/from\('crm_tarefas'\)\.update\(\{feito:true/);
 assert.match(operations,/\.eq\('empresa_id',profile\.empresa_id\)/);
 assert.match(details,/event\.task_id/);
 assert.match(details,/onFinish\?\.\(event\)/);
});
