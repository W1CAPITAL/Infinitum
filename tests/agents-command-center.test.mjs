import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('agentes route uses authenticated dashboard',()=>{const p=load('app/agentes/page.jsx');assert.match(p,/AgentsCommandCenter/);assert.match(p,/SecuredWorkspace/);});
test('legacy chat route redirects into the integrated agent workspace and preserves the selected bot',()=>{const p=load('app/agentes/chat/page.jsx');assert.match(p,/redirect/);assert.match(p,/view:'chat'/);assert.match(p,/searchParams/);});
test('dashboard uses six portrait assets and real activity tables',()=>{const u=load('components/agents-command-center.jsx');const c=load('components/agents-command-center.module.css');for(const k of ['hermes','atlas','nox','vega','lyra','oraculo-juridico']){assert.ok(u.includes('/agents/'+k+'.webp'));assert.ok(existsSync(new URL('../public/agents/'+k+'.webp',import.meta.url)));}assert.match(u,/office_agent_runs/);assert.match(u,/openbot_threads/);assert.match(c,/grid-template-columns/);});
test('six named profiles are defined in the dashboard',()=>{const u=load('components/agents-command-center.jsx');for(const n of ['Hermes','Atlas','Nox','Vega','Lyra','Oráculo Jurídico'])assert.ok(u.includes(n));});

test('agent cards, portraits and chat actions open the inline chat without leaving /agentes',()=>{
 const u=load('components/agents-command-center.jsx');
 assert.match(u,/OpenBotStudio/);
 assert.match(u,/openAgent/);
 assert.match(u,/setView\('chat'\)/);
 assert.match(u,/view==='chat'/);
 assert.doesNotMatch(u,/href=\{hrefFor\(a\)\}/);
});
test('embedded OpenBot receives the selected agent and saved conversation and can return to the team',()=>{
 const u=load('components/openbot-studio.jsx');
 assert.match(u,/initialBot/);
 assert.match(u,/initialThreadId/);
 assert.match(u,/embedded/);
 assert.match(u,/onBack/);
});
test('agent roster exposes recent private conversations and opens the selected thread in place',()=>{
 const u=load('components/agents-command-center.jsx');
 const chat=load('components/openbot-studio.jsx');
 assert.match(u,/openbot_threads/);
 assert.match(chat,/openbot_messages/);
 assert.match(u,/initialThreadId/);
 assert.match(u,/Histórico de conversas/);
});

test('embedded agent activity is backed by the real task ledger and profile preferences remain user-scoped',()=>{
 const center=load('components/agents-command-center.jsx');
 const chat=load('components/openbot-studio.jsx');
 assert.match(center,/office_agent_runs/);
 assert.match(center,/activityRuns=/);
 assert.match(chat,/activityRuns=\[\]/);
 assert.match(chat,/openbot_profiles/);
 assert.match(chat,/Memória de perfil/);
 assert.match(chat,/Fila de tarefas/);
 assert.match(chat,/Central de aprovações/);
});
