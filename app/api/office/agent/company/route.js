import {officeAuth,officeJson,safeOfficeError} from '../../../../../lib/office-server.mjs';
import {isDemoUserCompany} from '../../../../../lib/demo-tenant.mjs';
import {isLexisCompanyAdmin} from '../../../../../lib/crm-access.mjs';
import {normalizeOpenBotPolicy,DEFAULT_OPENBOT_COMPANY_POLICY,evaluateOpenBotInbound,deriveApprovedLearning} from '../../../../../lib/openbot-company-agent.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const err=(reason,status=400)=>{throw Object.assign(Error(reason),{status})};
const jidOk=x=>/^(?:[1-9][0-9]{9,14}@s\.whatsapp\.net|[0-9-]{6,30}@g\.us)$/.test(String(x||''));
async function companyFor(db,user){
 const r=await db.from('usuarios').select('empresa_id,role,cargo,nome').eq('auth_user_id',user.id).limit(2);
 if(r.error||r.data?.length!==1||!r.data?.[0]?.empresa_id)err('A empresa do usuário não pôde ser confirmada.',403);
 return r.data[0];
}
async function readPolicy(db,company){
 const p=await db.from('office_agent_company_policies').select('config,updated_at').eq('empresa_id',company).limit(1).maybeSingle();
 if(p.error)err('Configurações da empresa indisponíveis.',503);
 return {policy:normalizeOpenBotPolicy(p.data?.config||DEFAULT_OPENBOT_COMPANY_POLICY),updatedAt:p.data?.updated_at||null};
}
export async function GET(request){
 try{
  const {user,db}=await officeAuth(request);
  const member=await companyFor(db,user);
  const company=member.empresa_id;
  const [settings,contacts,votes]=await Promise.all([
   readPolicy(db,company),
   db.from('office_agent_contact_rules').select('jid,mode,assigned_staff,suppress_until,updated_at')
    .eq('empresa_id',company).gt('suppress_until',new Date().toISOString())
    .order('updated_at',{ascending:false}).limit(100),
   db.from('office_agent_style_votes').select('tag,approved_count,rejected_count')
    .eq('empresa_id',company).limit(50)
  ]);
  if(contacts.error||votes.error)err('Regras de atendimento ou aprendizado temporariamente indisponíveis.',503);
  const learning=deriveApprovedLearning((votes.data||[]).flatMap(x=>
   Array.from({length:Math.max(0,Math.min(20,x.approved_count||0))},()=>({tag:x.tag,approved:true}))));
  return officeJson({ok:true,...settings,canConfigure:isLexisCompanyAdmin(member),
   contacts:contacts.data||[],learning,
   note:'Configurações por empresa. Sem envio automático; somente rascunhos e confirmação individual.'});
 }catch(e){return safeOfficeError(e)}
}
export async function POST(request){
 try{
  const {user,db}=await officeAuth(request);
  const member=await companyFor(db,user);
  const company=member.empresa_id;
  if(await isDemoUserCompany(db,user.id))err('Demonstração não permite alterações de regras operacionais.',403);
  const data=await request.json().catch(()=>null);
  if(!data||typeof data!=='object'||Array.isArray(data))err('Dados inválidos.',400);
  const action=String(data.action||'');
  if(action==='settings'){
   if(!isLexisCompanyAdmin(member))err('Somente um administrador da empresa pode alterar regras globais.',403);
   const raw=data.policy;
   if(!raw||typeof raw!=='object'||Array.isArray(raw))err('Política inválida.',400);
   if(JSON.stringify(raw).length>18000)err('Configuração excessivamente grande.',400);
   const policy=normalizeOpenBotPolicy(raw);
   const up=await db.from('office_agent_company_policies').upsert({
    empresa_id:company,config:policy,updated_by:user.id,updated_at:new Date().toISOString()
   },{onConflict:'empresa_id'});
   if(up.error)err('Não foi possível salvar as regras da empresa.',503);
   return officeJson({ok:true,policy,notice:'Regras da empresa salvas. Nenhum envio automático foi habilitado.'});
  }
  if(action==='contact'){
   const jid=String(data.jid||'').trim(),mode=String(data.mode||'');
   if(!jidOk(jid)||!['staff_active','silence','administrative','review'].includes(mode))
    err('Número ou regra do contato inválidos.',400);
   const days=Math.max(1,Math.min(30,Number(data.days)||7));
   if(!Number.isFinite(days))err('Prazo de pausa inválido.',400);
   const result=await db.from('office_agent_contact_rules').upsert({
    empresa_id:company,jid,mode,assigned_staff:String(data.assigned_staff||member.nome||'').slice(0,90),
    suppress_until:new Date(Date.now()+days*86400000).toISOString(),
    updated_by:user.id,updated_at:new Date().toISOString()
   },{onConflict:'empresa_id,jid'});
   if(result.error)err('Não foi possível registrar o responsável pelo contato; peça autorização ao administrador se o contato pertence a outro atendente.',403);
   return officeJson({ok:true,notice:'Conversa protegida por '+days+' dias. O OpenBot não deve responder enquanto o responsável estiver ativo.'});
  }
  if(action==='feedback'){
   const tag=String(data.tag||''),approved=data.approved;
   if(!['more_cordial','more_concise','more_natural','avoid_repetition','mention_sources'].includes(tag)
    ||typeof approved!=='boolean')err('Feedback não reconhecido.',400);
   const r=await db.from('office_agent_style_votes').select('approved_count,rejected_count')
    .eq('empresa_id',company).eq('owner_id',user.id).eq('tag',tag).limit(1).maybeSingle();
   if(r.error)err('Histórico de feedback indisponível.',503);
   const entry={empresa_id:company,owner_id:user.id,tag,
    approved_count:Math.min(20,(r.data?.approved_count||0)+(approved?1:0)),
    rejected_count:Math.min(20,(r.data?.rejected_count||0)+(approved?0:1)),updated_at:new Date().toISOString()};
   const up=await db.from('office_agent_style_votes').upsert(entry,{onConflict:'empresa_id,owner_id,tag'});
   if(up.error)err('Feedback não registrado.',503);
   return officeJson({ok:true,notice:'Preferência de linguagem registrada. Só ganha peso após pelo menos três aprovações humanas; não altera fatos judiciais.'});
  }
  if(action==='group_task'){
   const jid=String(data.jid||''),text=String(data.text||'').trim().slice(0,450);
   if(!jidOk(jid)||!jid.endsWith('@g.us')||text.length<12)err('Informe uma mensagem de grupo válida.',400);
   const {policy}=await readPolicy(db,company);
   const decision=evaluateOpenBotInbound({policy,jid,isGroup:true,text});
   if(decision.decision!=='task_review')err('Este grupo não está autorizado ou não mencionou o OpenBot para registrar a tarefa.',403);
   const created=await db.from('crm_tarefas').insert({
    id:'openbot-grupo-'+crypto.randomUUID(),empresa_id:company,titulo:'OpenBot · revisar solicitação em grupo: '+text.slice(0,125),
    feito:false,due_at:new Date(Date.now()+86400000).toISOString().slice(0,10),
    created_by:user.id,assignee_id:user.id
   });
   if(created.error)err('Não foi possível registrar a tarefa para revisão.',503);
   return officeJson({ok:true,notice:'Solicitação adicionada às tarefas para revisão. Nenhuma resposta foi enviada ao grupo.'});
  }
  err('Ação não autorizada.',400);
 }catch(e){return safeOfficeError(e)}
}
