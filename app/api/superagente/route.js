import {NextResponse} from 'next/server';
import {GET as consultOfficialProcess} from '../processos/consulta/route.js';
import {requestedOfficialQuery,reportOfficialQuery} from '../../../lib/superagent-official-query.mjs';
import {officeAuth,safeOfficeError} from '../../../lib/office-server.mjs';
import {buildSuperAgentReview,targetCNJ} from '../../../lib/superagent-core.mjs';
import {formatProcessNumber} from '../../../lib/processos-oficiais.mjs';
import {planRemoteEngines} from '../../../lib/infinitum-agent-policy.mjs';
import {configuredLexisMotors,runLexisCascade} from '../../../lib/lexis-motor-cascade.mjs';
import {predictLmConfig,runPredictLmChat} from '../../../lib/predictlm-gateway.mjs';
import {qualityGate} from '../../../lib/lexis-predictlm-quality.mjs';
import {planPredictLmLegalCores} from '../../../lib/predictlm-office-cores.mjs';
import {validateBlackholePrompt,offlineBlackholeReply,configuredBlackholeProvider,generativeBlackholeReply,requiresPortfolio} from '../../../lib/blackhole-chat.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store,private'}});
export async function POST(request){
 try{
  const {db}=await officeAuth(request);
  const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  const body=await request.json();
  let prompt;try{prompt=validateBlackholePrompt(body?.prompt)}catch(e){return json({ok:false,error:e.message},400)}
  const core=planPredictLmLegalCores({prompt});
  // Local PredictLM reasoning signals; they never invoke a paid provider.
  const predictLmLocalCore={route:core.route,tier:core.tier,
    requiresHumanReview:core.requiresHumanReview,usesPaidProvider:false,
    verification:core.verification,policy:core.policy};
  // Consulta sob solicitacao explicita: reutiliza a autorizacao, fontes, cache e
  // backoff da propria rota manual. Nunca pede que o modelo invente publicacoes.
  const official=requestedOfficialQuery(prompt);
  if(official){
   const params=new URLSearchParams({numero:official.number,fonte:official.source});
   const queryRequest=new Request(new URL('/api/processos/consulta?'+params.toString(),request.url),{
    method:'GET',headers:{Authorization:'Bearer '+token}
   });
   const response=await consultOfficialProcess(queryRequest);
   const officialResult=await response.json();
   if(response.status===401||response.status===403||officialResult.code==='crm_access')
    return json({ok:false,error:officialResult.error||'Processo fora da carteira autorizada.'},response.status===401?401:403);
   const report=reportOfficialQuery({number:formatProcessNumber(official.number),source:official.source,result:officialResult});
   return json({ok:true,...report,predictLmLocalCore,model:'consulta-oficial',isGenerativeModel:false,
    notice:officialResult.ok?report.notice:
     'Consulta judicial nao confirmada: '+String(officialResult.error||'fonte indisponivel').slice(0,180)+'. Nenhum dado foi inventado.'});
  }
  const provider=configuredBlackholeProvider(process.env);
  const configured=configuredLexisMotors(process.env),predictlm=predictLmConfig(process.env);
  const preferredMotor=['auto','colibri','minicpm','minimax','claude','groq','xai','openrouter','gemini','predictlm'].includes(body?.preferredMotor)?body.preferredMotor:'auto';
  const plan=planRemoteEngines({preferred:preferredMotor,motors:configured,predictlm:!!predictlm,defaultProvider:!!provider,consent:body?.externalAiConsent===true,fallback:body?.allowEngineFallback===true});
  if(plan.mode==='missing')return json({ok:false,error:'Motor '+preferredMotor+' não está configurado neste servidor.'},503);
  if(plan.mode!=='none'){
   try{
    const history=Array.isArray(body?.messages)?body.messages.slice(-8).filter(m=>['user','assistant'].includes(m?.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,3400)})):[];
    const messages=[...history,{role:'user',content:prompt}];
    let answer;
    if(plan.mode==='predictlm')answer=await runPredictLmChat(messages,{config:predictlm});
    else if(plan.mode==='cascade'){
     try{answer=await runLexisCascade(messages,{motors:plan.motors,allowFallback:plan.allowFallback})}
     catch(e){if(!plan.predictlm)throw e;answer=await runPredictLmChat(messages,{config:predictlm})}
    }else answer={reply:await generativeBlackholeReply(provider,messages),model:provider.model,engine:'motor-online'};
    const gate=qualityGate(answer.reply);
    if(!gate.ok)throw Error('Resposta do modelo bloqueada por inconsistência; revisão necessária.');
    return json({ok:true,reply:gate.text,predictLmLocalCore,model:answer.model,engine:answer.engine,
     isGenerativeModel:true,notice:'Motor utilizado: '+answer.engine+'. Confira fundamentos jurídicos e fontes antes de agir.'});
   }catch(e){
    const fallback=offlineBlackholeReply(prompt);
    return json({ok:true,reply:fallback,predictLmLocalCore,model:'regras-locais',isGenerativeModel:false,
     notice:'O motor remoto não concluiu: '+String(e.message||'indisponível').slice(0,160)+
      '. Foi usado o modo local; nenhuma consulta judicial ou ação externa foi simulada.'});
   }
  }
  if(!requiresPortfolio(prompt))return json({ok:true,reply:offlineBlackholeReply(prompt),predictLmLocalCore,model:'regras-locais',isGenerativeModel:false,notice:'Resposta local. Nenhuma fonte judicial foi consultada.'});
  const number=targetCNJ(prompt),formatted=number?formatProcessNumber(number):null;
  let processQ=db.from('office_cases').select('id,process_number,title,subject,status,client_id').limit(formatted?5:250);
  if(formatted)processQ=processQ.eq('process_number',formatted);
  const [p,c,l]=await Promise.all([
   processQ,db.from('office_clients').select('id').limit(100),
   db.from('crm_leads').select('id').limit(100)
  ]);
  const errors=[p,c,l].filter(x=>x.error).map(x=>x.error.message);
  // Erro parcial de leitura não é sinônimo de carteira vazia. Para conversa simples,
  // ainda devolve uma resposta transparente sem prender o usuário.
  if(errors.length){
   return json({ok:true,reply:offlineBlackholeReply(prompt),predictLmLocalCore,model:'regras-locais',isGenerativeModel:false,
    notice:'Não foi possível ler todos os registros; nenhuma informação da carteira foi presumida.'});
  }
  const allowedNumbers=[...new Set((p.data||[]).map(x=>x.process_number).filter(Boolean))];
  const snaps=allowedNumbers.length?await db.from('crm_judicial_snapshots')
   .select('process_number,source,checked_at,payload')
   .in('process_number',allowedNumbers.slice(0,200)).order('checked_at',{ascending:false}).limit(200):
   {data:[],error:null};
  if(snaps.error)return json({ok:true,reply:offlineBlackholeReply(prompt),predictLmLocalCore,model:'regras-locais',isGenerativeModel:false,notice:'Histórico judicial indisponível. Nenhuma consulta foi presumida.'});
  const review=buildSuperAgentReview(prompt,{processes:p.data||[],snapshots:snaps.data||[],clients:c.data||[],leads:l.data||[]});
  return json({ok:true,reply:offlineBlackholeReply(prompt,{review}),review,predictLmLocalCore,model:'motor-de-evidencias',isGenerativeModel:false,
   notice:provider?'Modelo externo não utilizado porque não houve consentimento de envio.':'Modelo generativo não configurado; resposta do motor local verificável. Nenhuma ação externa foi executada.'});
 }catch(e){return safeOfficeError(e)}
}
