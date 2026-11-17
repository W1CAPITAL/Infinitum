import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('INFINITUM adds original OpenBot coworker panel inside authenticated agents area',()=>{
 assert.match(file('components/office-console.jsx'),/OpenBotWorkbench/);
 const ui=file('components/openbot-workbench.jsx');
 assert.match(ui,/runBlackholeQwen/);
 assert.match(ui,/checkBlackholeQwenSupport/);
 assert.match(ui,/SecuredWorkspace|office_agent_runs/);
 assert.match(ui,/ZAPFAST_SINGLE_SESSION_URL/);
 assert.match(ui,/buildQwenReviewPrompt/);
 assert.match(ui,/assessQwenReview/);
 assert.match(ui,/planColibriLocal/);
 assert.match(ui,/if\(!onlineConsent\)throw Error/);
 assert.match(ui,/fetch\('\/api\/superagente'/);
 assert.match(ui,/externalAiConsent:true/);
 assert.match(ui,/Authorization:'Bearer '/);
 assert.match(ui,/human|revis[aã]o|Revis/i);
 assert.doesNotMatch(ui,/sendMessage\(|api\/send|sendViaWaAuto\(/);
});
