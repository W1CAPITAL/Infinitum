import test from 'node:test';
import assert from 'node:assert/strict';
import {OPENBOT_COWORKERS,planAgentTask,reviewDraftGate,ZAPFAST_SINGLE_SESSION_URL} from '../lib/openbot-workspace-policy.mjs';

test('OpenBot workspace lists seven narrow legal coworkers, none can send independently',()=>{
 assert.equal(OPENBOT_COWORKERS.length,7);
 assert.ok(OPENBOT_COWORKERS.every(a=>!a.canSend&&!a.canShareCaseData&&a.id&&a.label));
});
test('judicial action requires official verification and human review',()=>{
 const p=planAgentTask('Envie a última movimentação do processo para o cliente');
 assert.equal(p.role,'atendimento');
 assert.equal(p.canSend,false);
 assert.equal(p.needsOfficialSource,true);
 assert.equal(p.needsHumanReview,true);
 assert.equal(planAgentTask('quais os honorários?').role,'revisao');
});
test('only manual validated draft for authorized client is reviewable, never sent',()=>{
 const draft={jid:'5511999988888@s.whatsapp.net',kind:'draft',processo_id:12,source:'DataJud',source_checked_at:'2026-11-15T12:00:00Z'};
 const ok=reviewDraftGate({draft,authorizedProcessIds:[12],now:new Date('2026-11-15T13:00:00Z')});
 assert.equal(ok.ok,true);assert.equal(ok.sendsWhatsapp,false);
 assert.equal(reviewDraftGate({draft,authorizedProcessIds:[13],now:new Date('2026-11-15T13:00:00Z')}).ok,false);
 assert.equal(reviewDraftGate({draft:{...draft,jid:'123@g.us'},authorizedProcessIds:[12]}).ok,false);
 assert.equal(reviewDraftGate({draft:{...draft,source_checked_at:'2026-08-10T00:00:00Z'},authorizedProcessIds:[12],now:new Date('2026-11-15T13:00:00Z')}).ok,false);
});
test('existing ZapFast session remains the only embedded link, no second QR',()=>{
 assert.equal(new URL(ZAPFAST_SINGLE_SESSION_URL).hostname,'zapfast-cloudflare-web.daviconcentrix.workers.dev');
});
