import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Fases e Provas e Processos Parados são áreas protegidas e acessíveis pelo menu',()=>{
 const nav=read('lib/crm-navigation.mjs'),shell=read('components/crm-shell.jsx');
 assert.match(nav,/path:'\/fases-provas'/);assert.match(nav,/path:'\/processos-parados'/);
 assert.match(shell,/'Fases e provas':FileSearch/);assert.match(shell,/'Processos parados':PauseCircle/);
 assert.match(read('app/fases-provas/page.jsx'),/SecuredWorkspace active="Fases e provas"/);
 assert.match(read('app/processos-parados/page.jsx'),/SecuredWorkspace active="Processos parados"/);
});

test('as duas áreas usam a carteira jurídica paginada e autenticada, não dados locais de demonstração',()=>{
 const workspace=read('components/lexis-process-intelligence-workspace.jsx');
 assert.match(workspace,/loadLexisProcessIntelligence/);
 assert.match(workspace,/pageSize:500,maxRows:20000/);
 assert.match(read('lib/lexis-process-intelligence.mjs'),/resolveCompanyAccess/);
 assert.match(read('lib/lexis-process-intelligence.mjs'),/row\?\.empresa_id!==profile\.empresa_id/);
});

test('fila de processos parados não envia mensagem nem altera o processo ao marcar tratado',()=>{
 const workspace=read('components/lexis-process-intelligence-workspace.jsx');
 assert.match(workspace,/saveHandledParado/);
 assert.match(workspace,/Não altera o processo, não registra atendimento no Supabase e não envia mensagem/);
 assert.doesNotMatch(workspace,/\.from\(['"]processos['"]\)\.update|sendWhatsApp|sendMessage/);
});

test('atalho do Scanner recebe o CNJ escolhido, sem disparar consulta automaticamente',()=>{
 const scanner=read('app/scanner/page.jsx');
 assert.match(scanner,/get\('cnj'\)/);
 assert.match(scanner,/setDirectCNJ\(cnj\)/);
 assert.match(scanner,/Consultar DJEN pelo meu navegador/);
});
