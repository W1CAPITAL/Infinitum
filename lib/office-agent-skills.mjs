// Curated, declarative Agent Skills registry for legal customer support.
// Inspired by anthropics/skills and the LexisPredict superagent. Agent Reach
// is read-only, and its Python CLI is NOT invoked by a Vercel function.
export const OFFICE_AGENT_SKILLS=Object.freeze([
 {id:'identity',title:'Identidade e autorização',source:'LexisPredict',
  requires:['valid_company','explicit_contact_grant','exact_private_jid'],canSend:false},
 {id:'judicial-research',title:'Pesquisa processual',source:'agent-reach (read-only concepts)',
  requires:['registered_process','official_CNJ_source','verified_time'],canSend:false},
 {id:'legal-context',title:'Memória limitada',source:'anthropics/skills (declarative workflow)',
  requires:['same_operator','same_chat','last_eight_messages'],canSend:false},
 {id:'plain-writing',title:'Redação simples',source:'LexisPredict/PredictLM',
  requires:['confirmed_facts','no_added_legal_claims','human_review_if_changed'],canSend:false},
 {id:'send-gate',title:'Segurança de envio',source:'LexisPredict/INFINITUM',
  requires:['inbound','business_hours','daily_limit','unique_message','exact_contact'],canSend:true},
 {id:'audit',title:'Registro e auditoria',source:'LexisPredict',
  requires:['accepted_transport','owner_company_scope','no_claim_of_delivery'],canSend:false}
].map(x=>Object.freeze(x)));
export function selectOfficeAgentSkills({question='',action='preview'}={}){
 const q=String(question||'').toLowerCase();
 const set=['identity','legal-context','send-gate','audit'];
 if(/processo|tribunal|andamento|djen|datajud|consulta/.test(q)||action==='research')set.push('judicial-research');
 if(action==='preview'||action==='send'||/responda|texto|mensagem/.test(q))set.push('plain-writing');
 return OFFICE_AGENT_SKILLS.filter(x=>set.includes(x.id));
}
export const OFFICE_AGENT_UPSTREAMS=Object.freeze({
 research:'https://github.com/Panniantong/Agent-Reach',
 skills:'https://github.com/anthropics/skills',
 lexispredict:'https://github.com/W1CAPITAL/LexisPredict',
 predictlm:'https://github.com/W2CAPITAL/PredictLm'
});
