import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CRM_AREAS,crmAreaHref,areaFromQuery} from '../lib/crm-navigation.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('a navegação principal é de um escritório jurídico e não de quitações',()=>{
 const labels=CRM_AREAS.map(x=>x.label);
 assert.deepEqual(labels,['Painel jurídico','Processos','Encerrados','Atividades','Análises internas','Scanner judicial','Tarefas','Vencidos','Supervisão','Fases e provas','Processos parados','Fluxos (POP)','Audiências','Agenda','Peças e petições','WhatsApp','Leads','Gerador de processos','Superagente','Mini Agentes','Relatórios','Integrações','Configurações']);
 assert.equal(crmAreaHref('Clientes'),'/processos');assert.equal(crmAreaHref('Processos'),'/processos');
 assert.equal(crmAreaHref('Tarefas'),'/tarefas');assert.equal(crmAreaHref('Vencidos'),'/vencidos');assert.equal(crmAreaHref('Supervisão'),'/supervisao');assert.equal(crmAreaHref('Fases e provas'),'/fases-provas');assert.equal(crmAreaHref('Processos parados'),'/processos-parados');
 assert.equal(crmAreaHref('Peças e petições'),'/pecas');
 assert.equal(labels.filter(x=>x==='WhatsApp').length,1);
 assert.ok(!labels.some(x=>/quitação|finalizados|instituições/i.test(x)));
});
test('rotas e seleção mantêm identidade jurídica',()=>{
 assert.equal(areaFromQuery('?aba=clientes'),'Processos');
 assert.equal(areaFromQuery('?aba=processos'),'Processos');
 assert.equal(areaFromQuery('?aba=tarefas'),'Tarefas');assert.equal(areaFromQuery('?aba=vencidos'),'Vencidos');
 assert.equal(areaFromQuery(''),'Painel jurídico');
 assert.equal(areaFromQuery('?aba=inexistente'),'Painel jurídico');
});
test('escritório compartilhado usa auth e único sidebar',()=>{
 assert.match(read('app/page.jsx'),/OfficeConsole/);
 assert.match(read('app/processos/page.jsx'),/OfficeConsole/);
 assert.match(read('components/office-console.jsx'),/SecuredWorkspace/);
 assert.match(read('components/secured-workspace.jsx'),/useWorkspaceSession/);
 assert.match(read('components/workspace-session-provider.jsx'),/useCrmAccess/);
 assert.match(read('components/crm-shell.jsx'),/aria-label="Navegação principal"/);
 assert.doesNotMatch(read('components/crm-shell.jsx'),/Quitações/);
});
test('prazos são organizados com vencidos/hoje/semana na nova carteira',()=>{
 const ui=read('components/office-console.jsx');
 assert.match(ui,/deadlineFilter/);
 assert.match(ui,/deadlineState/);
 assert.match(ui,/office_deadlines/);
});

test('carteira única elimina abas redundantes e preserva atalhos legados',()=>{
 assert.equal(CRM_AREAS.some(x=>['/clientes','/prazos'].includes(x.path)),false);
 assert.equal(crmAreaHref('Prazos'),'/agenda?tipo=prazo');
 assert.equal(areaFromQuery('?aba=prazos'),'Agenda');
 assert.match(read('app/clientes/page.jsx'),/redirect\('\/processos/);
 assert.match(read('app/prazos/page.jsx'),/redirect\(/);
 assert.match(read('components/lexis-shared-office.jsx'),/InfinitumLegacyClients/);
 assert.doesNotMatch(read('components/crm-shell.jsx'),/href:'\/clientes'/);
});
