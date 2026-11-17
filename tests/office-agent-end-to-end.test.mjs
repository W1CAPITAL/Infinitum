import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('server exposes authenticated narrow research, preview, consent and idempotent send only',()=>{
 const src=read('app/api/office/agent/reply/route.js');
 assert.match(src,/officeAuth\(request\)/);
 assert.match(src,/waAutoOperation\('send'/);
 assert.match(src,/reserve_office_agent_reply/);
 assert.match(src,/finalize_office_agent_reply/);
 assert.match(src,/buildVerifiedReply/);
 assert.match(src,/routeInboundQuestion/);
 assert.match(src,/action==='authorize'/);
 assert.match(src,/action==='preview'/);
 assert.match(src,/action!=='preview'&&action!=='send'/);
 assert.match(src,/data.confirm_send!==true/);
 assert.match(src,/action==='research'/);
 assert.match(src,/office_agent_chat_memory/);
 assert.doesNotMatch(src,/SERVICE_ROLE_KEY|setInterval|sendBulk|Promise\.all\(.*send/);
});
test('UI offers concrete agent research, reply and memory but not mass sends',()=>{
 const inbox=read('components/wa-auto-inbox.jsx');
 assert.match(inbox,/OfficeLegalAgentPanel/);
 const ui=read('components/office-legal-agent-panel.jsx');
 assert.match(ui,/prepareLegalAgentReply/);
 assert.match(ui,/authorizeLegalAgentContact/);
 assert.match(ui,/sendLegalAgentReply/);
 assert.match(ui,/researchLegalAgentCase/);
 assert.match(ui,/saveLegalAgentMemory/);
 assert.match(ui,/maxLength=\{1000\}/);
 assert.doesNotMatch(ui,/bulkSend|Enviar para todos|enviar em massa/);
});
test('only curated Agent Skills metadata is used, no subprocess or untrusted execution',()=>{
 const src=read('lib/office-agent-skills.mjs');
 assert.match(src,/agent-reach/);
 assert.match(src,/anthropics\/skills/);
 assert.match(src,/LexisPredict/);
 assert.match(src,/PredictLM/);
 assert.doesNotMatch(src,/exec\(|eval\(|spawn\(|child_process/);
});
