// OpenBot-inspired role workflow for INFINITUM. Not an OpenBot server.
// Every external action remains with authenticated operator.
export const ZAPFAST_SINGLE_SESSION_URL='https://zapfast-cloudflare-web.daviconcentrix.workers.dev/';
export const OPENBOT_COWORKERS=Object.freeze([
  {id:'identidade',label:'Identificação',role:'Confere autorização do contato e o processo exato'},
  {id:'tribunais',label:'Fontes oficiais',role:'Examina DataJud/DJEN e identifica consultas não confirmadas'},
  {id:'memoria',label:'Memória jurídica',role:'Organiza atividades, anotações e atendimentos sem divulgar dados internos'},
  {id:'redacao',label:'Redação clara',role:'Prepara rascunhos curtos em português simples'},
  {id:'revisao',label:'Conformidade',role:'Interrompe temas sensíveis, administrativos ou com divergências'},
  {id:'atendimento',label:'Atendimento',role:'Separa mensagens recebidas de clientes autorizados para revisão'},
  {id:'navegador-local',label:'Aba autorizada',role:'Observa somente a conversa aberta no WhatsApp Web mediante autorização temporária; prepara rascunho sem enviar',canReadAuthorizedTab:true}
].map(x=>Object.freeze({...x,canSend:false,canShareCaseData:false})));
const judicial=/processo|juiz|judicial|tribunal|djen|datajud|senten[cç]a|audi[eê]ncia|movimenta[cç][aã]o|andamento|recurso/i;
const messages=/whatsapp|mensagem|envi[ae]|responda|retorno|cliente|atendimento|zapfast|wa[.-]?auto/i;
const sensitive=/honor[aá]rio|pagamento|pix|contrato|acordo|saque|conta banc[aá]ria|boleto|desistir|bloqueio|aposentadoria|cobran[cç]a/i;
export function planAgentTask(input){
 const q=String(input||'').slice(0,2000);
 const role=sensitive.test(q)?'revisao':messages.test(q)?'atendimento':judicial.test(q)?'tribunais':'memoria';
 return {role,canSend:false,needsOfficialSource:judicial.test(q),needsHumanReview:true,
  localEngine:'deterministico',localQwenOnlyWithOptIn:true,externalColibriOnlyWithOptIn:true};
}
export function reviewDraftGate({draft,authorizedProcessIds=[],now=new Date()}={}){
 const deny=reason=>({ok:false,reason,sendsWhatsapp:false});
 if(!draft||draft.kind!=='draft'||!/^[0-9]+@(s\.whatsapp\.net|lid)$/.test(draft.jid||''))return deny('private_draft_required');
 if(!authorizedProcessIds.some(x=>String(x)===String(draft.processo_id)))return deny('unauthorized_case');
 if(!['DataJud','DJEN','tribunal'].includes(draft.source))return deny('official_source_missing');
 const at=Date.parse(draft.source_checked_at||'');
 if(!Number.isFinite(at)||at>now.getTime()+300000||now.getTime()-at>7*86400000)return deny('outdated_source');
 return {ok:true,reason:'manual_review_only',sendsWhatsapp:false};
}
