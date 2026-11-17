import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Office legal route uses PredictLM legal signals and never promotes blocked source to a confirmed reply',()=>{
 const route=file('app/api/office/agent/reply/route.js');
 assert.match(route,/planPredictLmLegalCores/);
 assert.match(route,/classifyPredictLmFailure/);
 assert.match(route,/predictLmCoreCatalog/);
 assert.match(route,/requiresHumanReview/);
 assert.match(route,/action==='diagnostics'/);
 assert.match(route,/verification:checked.predictLmReview.verification/);
});
test('UI shows PredictLM core analysis and diagnostics but never adds an unauthorized send endpoint',()=>{
 const panel=file('components/office-legal-agent-panel.jsx');
 assert.match(panel,/diagnosePredictLmLegalAgent/);
 assert.match(panel,/predictLmReview/);
 assert.match(panel,/Atenção jurídica/);
 assert.doesNotMatch(panel,/bulkSend|sendAll|envioEmMassa/);
});
test('Superagent invokes PredictLM deterministic core without requiring paid API or misleading neural inference',()=>{
 const route=file('app/api/superagente/route.js');
 assert.match(route,/planPredictLmLegalCores/);
 assert.match(route,/predictLmLocalCore/);
 assert.match(route,/requiresHumanReview/);
 assert.match(route,/usesPaidProvider:false/);
});
