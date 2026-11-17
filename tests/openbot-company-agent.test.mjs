import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_OPENBOT_COMPANY_POLICY,normalizeOpenBotPolicy,contactNameVariants,rankProcessCandidates,evaluateOpenBotInbound,planNextOpenBotReturn,composeOpenBotCaseReply,deriveApprovedLearning,isConciliationLinkRequest} from '../lib/openbot-company-agent.mjs';

test('company rules default to silent drafts: no bulk messaging, unknown contact or administrative interception',()=>{
 const p=DEFAULT_OPENBOT_COMPANY_POLICY;
 assert.equal(p.reply_mode,'draft_only');assert.equal(p.groups,'ignore');assert.equal(p.only_private,true);
 assert.equal(p.require_process_context,true);assert.equal(p.administrative,'mention_only');
 assert.equal(p.excluded_contacts.length,0);
 assert.equal(normalizeOpenBotPolicy({reply_mode:'auto_send',return_min_days:1}).reply_mode,'draft_only');
 assert.equal(normalizeOpenBotPolicy({return_min_days:15,return_max_days:30}).return_max_days,30);
});
test('profiles with names separated by slash or dash recover real legal client names',()=>{
 const variants=contactNameVariants('Letícia/ Rafael Chaves - Financeiro');
 assert.ok(variants.includes('rafael chaves'));
 assert.ok(variants.includes('leticia'));
 assert.ok(!variants.some(v=>v.includes('financeiro')));
 const options=[
  {id:10,cliente:'Rafael Chaves',telefone:''},
  {id:11,cliente:'Letícia Pereira',telefone:''}
 ];
 const ranked=rankProcessCandidates({profileName:'Letícia/ Rafael Chaves',phone:'',cases:options});
 assert.equal(ranked[0].id,10);
 assert.equal(ranked[0].canAutoAssociate,false);
 assert.equal(ranked[0].candidateOnly,true);
});
test('exact phone and unique process may be proposed but manual authorization still required',()=>{
 const rows=[{id:2,cliente:'Maria das Graças',telefone:'(11) 99999-9999'}];
 const r=rankProcessCandidates({profileName:'Maria - Recepção',phone:'5511999999999',cases:rows});
 assert.equal(r[0].id,2);assert.equal(r[0].matchedBy,'phone');assert.equal(r[0].canAutoAssociate,false);
});
test('company exceptions, group and staff handoff suppress responses before the model sees the chat',()=>{
 const policy=normalizeOpenBotPolicy({excluded_contacts:[{kind:'phone',value:'5511999999999'},{kind:'name',value:'Administrador'}]});
 const base={policy,jid:'5511888888888@s.whatsapp.net',contactName:'Cliente',authorized:true,
  text:'Qual o andamento do meu processo?',history:[],isGroup:false,staffRepliedAfter:false};
 assert.equal(evaluateOpenBotInbound({...base,jid:'5511999999999@s.whatsapp.net'}).decision,'ignore');
 assert.equal(evaluateOpenBotInbound({...base,contactName:'Administrador'}).decision,'ignore');
 assert.equal(evaluateOpenBotInbound({...base,isGroup:true}).decision,'ignore');
 assert.equal(evaluateOpenBotInbound({...base,staffRepliedAfter:true}).decision,'ignore');
 assert.equal(evaluateOpenBotInbound({...base,administrativeContact:true}).decision,'ignore');
 assert.equal(evaluateOpenBotInbound({...base,authorized:false}).decision,'review');
 assert.equal(evaluateOpenBotInbound({...base,mediaType:'audio',text:'[Áudio]'}).decision,'research');
 assert.equal(evaluateOpenBotInbound({...base,mediaType:'ptt',text:'Mensagem de voz'}).askForTranscription,false);
});
test('only specified group with explicit mention may be routed to question/task review, never send',()=>{
 const policy=normalizeOpenBotPolicy({groups:'internal_only',allowed_group_jids:['120123456789012345@g.us'],
  bot_mentions:['@OpenBot']});
 const base={policy,jid:'120123456789012345@g.us',isGroup:true,text:'@OpenBot anote a tarefa para falar com o advogado',
  authorized:false};
 const r=evaluateOpenBotInbound(base);
 assert.equal(r.decision,'task_review');
 assert.equal(r.sendsWhatsapp,false);
 assert.equal(evaluateOpenBotInbound({...base,text:'Bom dia pessoal'}).decision,'ignore');
 assert.equal(evaluateOpenBotInbound({...base,jid:'999999@g.us'}).decision,'ignore');
});
test('administrative contact only gets a draft if directly mentioned and a process is verified',()=>{
 const policy=normalizeOpenBotPolicy({administrative:'mention_only',bot_mentions:['@OpenBot']});
 const base={policy,jid:'5511888888888@s.whatsapp.net',authorized:true,administrativeContact:true,
  text:'Andamento do processo?',isGroup:false};
 assert.equal(evaluateOpenBotInbound(base).decision,'ignore');
 assert.equal(evaluateOpenBotInbound({...base,text:'@OpenBot andamento do processo?'}).decision,'draft');
});
test('audio without transcript never asks for transcription: uses authorized case for research',()=>{
 const policy=normalizeOpenBotPolicy({audio_without_transcript:'status_if_authorized'});
 const base={policy,jid:'5511888888888@s.whatsapp.net',authorized:true,isGroup:false,mediaType:'audio',
  text:'',history:[]};
 const r=evaluateOpenBotInbound(base);
 assert.equal(r.decision,'research');
 assert.equal(r.askForTranscription,false);
 assert.equal(evaluateOpenBotInbound({...base,authorized:false}).decision,'review');
});
test('short follow-up uses earlier process context and avoids rewriting the same movement after prior answer',()=>{
 const p=DEFAULT_OPENBOT_COMPANY_POLICY;
 const r=evaluateOpenBotInbound({policy:p,jid:'5511888888888@s.whatsapp.net',authorized:true,
  text:'Alguma novidade?',history:[{content:'O processo foi encaminhado ao juiz',is_from_me:true}]});
 assert.equal(r.decision,'draft');
 const reply=composeOpenBotCaseReply({
  sourceText:'Na última consulta confirmada ao DataJud, em 01/03/2026, o processo foi encaminhado ao juiz.',
  sourceAt:'2026-11-16',movementAt:'2026-03-01',lastReturnAt:'2026-10-20',
  history:[{content:'O processo foi encaminhado ao juiz.',is_from_me:true}],
  policy:p,clientName:'Rafael Chaves'
 });
 assert.equal(reply.repeatedUpdate,true);
 assert.match(reply.text,/desde nosso último atendimento|nenhuma nova movimentação/i);
 assert.doesNotMatch(reply.text,/em 01\/03\/2026, o processo foi encaminhado/i);
});
test('next return uses 15-30 day company limits and pauses further when case is stagnant',()=>{
 const policy=normalizeOpenBotPolicy({return_min_days:15,return_max_days:30,return_stalled_days:30,stalled_after_days:75});
 const now=new Date('2026-11-16T12:00:00Z');
 assert.equal(planNextOpenBotReturn({now,policy,movementAt:'2026-03-01'}).days,30);
 const latest=planNextOpenBotReturn({now,policy,movementAt:'2026-11-10'});
 assert.ok(latest.days>=15&&latest.days<=30);
 assert.equal(planNextOpenBotReturn({now,policy,movementAt:'2026-03-01'}).dueDate,'2026-12-16');
});
test('feedback becomes a preference only after repeated human confirmations, never a new factual claim',()=>{
 const entries=[{tag:'more_cordial',approved:true},{tag:'more_cordial',approved:true},{tag:'more_cordial',approved:true},
  {tag:'invented_law',approved:true},{tag:'avoid_repetition',approved:false}];
 const p=deriveApprovedLearning(entries);
 assert.ok(p.includes('more_cordial'));
 assert.ok(!p.includes('invented_law'));assert.ok(!p.includes('avoid_repetition'));
});

test('approved training votes actually change phrasing without changing court facts',()=>{
 const evidence='Consulta oficial confirmada: documento juntado em 14/11/2026.';
 const votes=[{tag:'more_natural',approved_count:4,rejected_count:0},
  {tag:'more_concise',approved_count:3,rejected_count:0},
  {tag:'mention_sources',approved_count:4,rejected_count:0}];
 const out=composeOpenBotCaseReply({
  sourceText:evidence,sourceAt:'2026-11-15T14:00:00Z',
  movementAt:'2026-11-14',lastReturnAt:'2026-11-01',policy:DEFAULT_OPENBOT_COMPANY_POLICY,learning:votes
 });
 assert.match(out.text,/documento juntado em 14\/11\/2026/);
 assert.match(out.text,/DataJud|fonte oficial/i);
 assert.doesNotMatch(out.text,/Seguimos à disposição\./);
 assert.equal(out.requiresHumanReview,true);
});

test('confirmed conciliation access request can be handled under human review without turning other sensitive asks into routine replies',()=>{
 assert.equal(isConciliationLinkRequest('Pode me mandar o link da audiência de conciliação?'),true);
 assert.equal(isConciliationLinkRequest('Quando será minha audiência?'),true);
 assert.equal(isConciliationLinkRequest('Quero recorrer da sentença e o link da audiência'),false);
 assert.equal(isConciliationLinkRequest('Vai ter acordo e quanto vou receber na audiência?'),false);
 assert.equal(isConciliationLinkRequest('O prazo de recurso venceu?'),false);
});

test('due date uses São Paulo local day rather than UTC crossing midnight',()=>{
 const r=planNextOpenBotReturn({
  now:new Date('2026-11-17T01:00:00Z'),
  movementAt:'2026-03-01',
  policy:normalizeOpenBotPolicy({return_min_days:15,return_max_days:30,return_stalled_days:30})
 });
 assert.equal(r.dueDate,'2026-12-16');
});
