// Original lightweight adaptation of PredictLM cognitive-surface.ts,
// agent-runtime/routing.ts, legal/attention.ts and error-recovery.ts.
// Four "cores" are deterministic SOFTWARE signals, not loaded neural weights
// or biological brain simulations. All case actions remain under office policy.
const rules=Object.freeze([
 {id:'bloqueio',level:'critical',pattern:/\b(bloqueio|bloquead[oa]|sisbajud|bacenjud|aposentadoria)\b/i},
 {id:'penhora',level:'critical',pattern:/\b(penhora|penhorad[oa]|arresto|sal[aá]rio)\b/i},
 {id:'pagamento',level:'high',pattern:/\b(pagamento|honor[aá]rios?|pix|saque|boleto|dep[oó]sito)\b/i},
 {id:'sentenca',level:'high',pattern:/\b(sent[ée]n[cç]a|ganhei|ganhamos|perdi|proced[eê]n|improced[eê]n|condena[cç][aã]o)\b/i},
 {id:'recurso',level:'high',pattern:/\b(recurso|apela[cç][aã]o|embargos|agravo|liminar)\b/i},
 {id:'prazo',level:'high',pattern:/\b(prazo|audi[eê]ncia|intima[cç][aã]o|acordo|desist[eê]ncia)\b/i},
 {id:'pesquisa',level:'attention',pattern:/\b(djen|datajud|tribunal|processo|andamento|movimenta[cç][aã]o)\b/i}
]);
const clip=(v,n=1300)=>String(v??'').slice(0,n);
const norm=s=>clip(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const legal=/processo|andamento|djen|datajud|tribunal|cnj|judicial|sentenc|bloqueio|penhora|julgad|recurso|audi[eê]ncia|prazo|honor[aá]rio/i;
const rank={info:0,attention:1,high:2,critical:3};
const levels={invalidInput:'Os parâmetros da consulta precisam ser corrigidos.',
  auth:'A autenticação da fonte falhou. É necessário verificar o acesso.',
  forbidden:'A fonte recusou acesso. Não é possível concluir a pesquisa.',
  notFound:'O endereço da consulta não foi encontrado. Confira a integração.',
  conflict:'A consulta ou operação está em conflito. Confira o estado antes de repetir.',
  locked:'A fonte bloqueou temporariamente novas consultas. Aguarde a liberação.',
  rateLimit:'A fonte limitou as consultas. Aguarde o intervalo de segurança.',
  upstream:'O serviço judicial está indisponível. A movimentação não pôde ser confirmada.',
  unsupported:'Este tipo de consulta não é oferecido por essa fonte.',
  timeout:'A fonte excedeu o tempo permitido. Não houve confirmação de andamento.',
  network:'A conexão com a fonte falhou. Não houve confirmação de andamento.',
  unknown:'Não foi possível classificar a falha; encaminhe para revisão.'};
export function classifyPredictLmFailure(input){
 const s=typeof input==='number'?input:Number(input?.status||input?.code||0);
 const message=norm(input?.message||'');
 let kind='unknown',retryable=false,waitMs=0;
 if(s===400){kind='invalid-input'}
 else if(s===401){kind='auth'}
 else if(s===403){kind='forbidden'}
 else if(s===404){kind='not-found'}
 else if(s===409){kind='conflict'}
 else if(s===423){kind='locked';retryable=true;waitMs=120000}
 else if(s===429){kind='rate-limit';retryable=true;waitMs=60000}
 else if(s===501){kind='unsupported'}
 else if(s>=500){kind='upstream';retryable=true;waitMs=30000}
 else if(/timeout|timed out|tempo esgotado|abort/.test(message)){kind='timeout';retryable=true;waitMs=30000}
 else if(/network|fetch failed|econnreset|dns|rede/.test(message)){kind='network';retryable=true;waitMs=30000}
 return {kind,retryable,waitMs,automaticRetry:false,userMessage:levels[
   ({'invalid-input':'invalidInput','rate-limit':'rateLimit','not-found':'notFound'}[kind]||kind)
 ]||levels.unknown};
}
export function predictLmCoreCatalog(){
 return [
  {id:'fly',name:'Atenção e urgência'},
  {id:'mouse',name:'Conflitos e incerteza'},
  {id:'macaque',name:'Sequência processual'},
  {id:'human',name:'Checagem de evidência e ação'},
  {id:'jev',name:'Roteamento por complexidade'},
  {id:'recovery',name:'Classificação de falhas'},
  {id:'centum',name:'Perguntas críticas antes de agir'}
 ].map(x=>Object.freeze({...x,mode:'deterministic_read_only',canSendWhatsapp:false,canCrossTenant:false}));
}
export function planPredictLmLegalCores({
 prompt='',movement='',source='',officialConfirmed=false,checkedAt='',now=new Date(),sourceError=null
}={}){
 const input=clip(prompt),movementText=clip(movement,300);
 const signals=rules.filter(x=>x.pattern.test(input)).map(x=>({id:x.id,level:x.level}));
 const movementSignals=rules.filter(x=>x.level!=='attention'&&x.pattern.test(movementText))
  .map(x=>({id:x.id,level:x.level}));
 const maxLevel=signals.reduce((best,x)=>Math.max(best,rank[x.level]),0);
 const movementRisk=movementSignals.reduce((best,x)=>Math.max(best,rank[x.level]),0);
 const checked=new Date(checkedAt).getTime(),time=now instanceof Date?now.getTime():new Date(now).getTime();
 const recent=Number.isFinite(checked)&&Number.isFinite(time)&&
  checked<=time+300000&&time-checked<=7*86400000;
 const officialOk=officialConfirmed===true&&recent&&['DataJud','DJEN','tribunal'].includes(source)&&!sourceError;
 const legalPrompt=legal.test(input);
 const tier=maxLevel>=2?'strong':legalPrompt?'balanced':'fast';
 const requiresHumanReview=!officialOk||maxLevel>=2||movementRisk>=2;
 const route=legalPrompt?'scanner-processual':'predict-orchestrator';
 // Scores are inspectable deterministic control signals, NOT literal simulated brains.
 const scores={
  fly:Math.min(100,20+maxLevel*23),
  mouse:officialOk?20:95,
  macaque:movementText?75:10,
  human:officialOk?(requiresHumanReview?50:94):0
 };
 return {
  route,tier,signals,movementSignals,cores:scores,verification:officialOk?'verified':'unverified',
  requiresHumanReview,sendsWhatsApp:false,usesPaidProvider:false,
  policy:'PredictLM four-core software controls; only verified external sources establish court facts.',
  reason:!officialOk?'source_not_verified':maxLevel>=2?'high_risk_client_question':
   movementRisk>=2?'complex_official_event':'ordinary_procedural_message',
  sourceError:sourceError?classifyPredictLmFailure(sourceError):null
 };
}
