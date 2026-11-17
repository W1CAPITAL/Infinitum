'use client';
import {useEffect,useState} from 'react';
import ui from './killa-workbench.module.css';
import {ZAPFAST_SINGLE_SESSION_URL} from '../lib/openbot-workspace-policy.mjs';
import {runBlackholeQwen,stopBlackholeQwen,checkBlackholeQwenSupport,getQwenCacheStatus} from '../lib/blackhole-local-llm.mjs';
import {offlineBlackholeReply} from '../lib/blackhole-chat.mjs';
import {planColibriLocal} from '../lib/colibri-local.mjs';
import {resolveLocalQwenModel} from '../lib/local-qwen-runtime.mjs';
import {buildQwenReviewPrompt,assessQwenReview} from '../lib/qwen-review-guard.mjs';
import {buildPredictLmPetition,buildPredictLmLegalSectionPrompt,createLegalDocumentHtml,createLegalTimelineSvg} from '../lib/predictlm-legal-studio.mjs';

export default function OpenBotWorkbench({db,session}){
 const [prompt,setPrompt]=useState('');
 const [draft,setDraft]=useState('');
 const [source,setSource]=useState('');
 const [engine,setEngine]=useState('deterministico');
 const [consent,setConsent]=useState(false);
 const [onlineConsent,setOnlineConsent]=useState(false);
 const [preferCpu,setPreferCpu]=useState(true),[tokenBudget,setTokenBudget]=useState(128);
 const [mode,setMode]=useState('texto'),[kind,setKind]=useState('manifestacao');
 const [timelineEvents,setTimelineEvents]=useState(''),[timelineSvg,setTimelineSvg]=useState('');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [approved,setApproved]=useState(false),[reviewNote,setReviewNote]=useState('');
 const [cacheInfo,setCacheInfo]=useState(null);

 const localSelected=['colibri-local','qwen','qwen17','qwen4'].includes(engine);
 const modelId=resolveLocalQwenModel(engine);
 useEffect(()=>()=>stopBlackholeQwen(),[]);
 useEffect(()=>{
  let present=true;
  getQwenCacheStatus().then(info=>{if(present)setCacheInfo(info)}).catch(()=>{});
  return()=>{present=false};
 },[]); 
 useEffect(()=>{
  if(typeof BroadcastChannel==='undefined')return;
  const channel=new BroadcastChannel('infinitum-qwen-preinstall');
  let lastRead=0;
  channel.onmessage=event=>{
   if(event.data?.type!=='qwen-preinstall')return;
   const now=Date.now();
   if(event.data.status==='complete'||now-lastRead>5000){
    lastRead=now;
    getQwenCacheStatus().then(setCacheInfo).catch(()=>{});
   }
  };
  return()=>channel.close();
 },[]);
 async function generate(){
  if(!prompt.trim()||busy)return;
  const userText=prompt.trim().slice(0,3500);
  setBusy(true);setDraft('');setApproved(false);setSource('');setNotice('');
  try{
   let answer,model;
   if(engine==='online'){
    if(!onlineConsent)throw Error('Autorize o envio do texto ao modelo online antes de gerar.');
    if(!db||!session?.user?.id)throw Error('Entre no CRM para utilizar a IA online.');
    const {data:{session:authSession},error:authError}=await db.auth.getSession();
    if(authError||!authSession?.access_token)throw Error('Sessão expirada. Faça login novamente.');
    const response=await fetch('/api/superagente',{method:'POST',
     headers:{Authorization:'Bearer '+authSession.access_token,'Content-Type':'application/json'},
     body:JSON.stringify({prompt:userText,externalAiConsent:true,allowEngineFallback:true,preferredMotor:'auto'}),
     cache:'no-store',signal:AbortSignal.timeout(40000)});
    let output;try{output=await response.json()}catch{throw Error('O servidor de IA não devolveu uma resposta válida.')}
    if(!response.ok||output.ok!==true)throw Error(output.error||'Modelo de IA indisponível.');
    if(typeof output.reply!=='string'||!output.reply.trim())throw Error('O modelo não retornou uma resposta.');
    setDraft(output.reply.slice(0,18000));
    setSource(output.isGenerativeModel?('IA online · '+String(output.model||'modelo configurado')):'Motor de regras (IA online indisponível)');
    setNotice(output.notice||'Rascunho pronto. Revise os dados antes de usar.');
    return;
   }
   if(localSelected){
    const isPetition=mode==='peca';
    const authoritative=isPetition
      ?buildPredictLmPetition({kind,instructions:userText}).body
      :offlineBlackholeReply(userText);
    answer=authoritative;
    model=isPetition?'Minuta determinística PredictLM/LexisPredict · não protocolada':
      'Motor determinístico · sem consulta judicial';
    setDraft(authoritative.slice(0,18000));setSource(model);
     let profile={ok:false,reason:'Qwen não autorizado',device:'none'};
    if(consent)profile=await checkBlackholeQwenSupport({preferCpu,modelId});
    const route=planColibriLocal({prompt:userText,allowLocalModel:consent,
      device:{webgpu:profile.device==='webgpu',memoryGb:Number(navigator?.deviceMemory||0),preferCpu},modelId});
    if(route.engine==='qwen'){
      try{
        const generatorPrompt=isPetition
          ?buildPredictLmLegalSectionPrompt({kind,instructions:userText})
          :buildQwenReviewPrompt(authoritative);
        const out=await runBlackholeQwen(generatorPrompt,[],p=>setNotice(p.message||p.status),
          {consent:true,maxTokens:tokenBudget,timeoutMs:600000,preferCpu,modelId});
        getQwenCacheStatus().then(setCacheInfo).catch(()=>{});
        if(isPetition){
          answer=authoritative+'\n\n--- SUGESTÃO DO QWEN (NÃO VERIFICADA — ADVOGADO DEVE CONFERIR) ---\n'+out.reply;
          model='Minuta estruturada + '+out.model+' ('+out.device+') · revisão obrigatória';
          setNotice('Trecho redigido no navegador. A IA não verificou decisões, leis ou documentos; confira tudo antes de usar.');
        }else{
          const checked=assessQwenReview(authoritative,out.reply);
          if(checked.ok){
            answer=checked.text;model=out.model+' ('+out.device+') revisou a redação · fatos determinísticos';
            setNotice('Revisão feita no navegador, sem consulta judicial ou envio externo.');
          }else{
            model='Motor determinístico · revisão do Qwen rejeitada';
            setNotice('O Qwen alterou elementos protegidos ('+checked.reason+'). Rascunho original mantido.');
          }
        }
      }catch(error){
        setNotice('IA local não concluiu: '+String(error.message||error).slice(0,180)+'. O rascunho estruturado foi preservado.');
      }
    }else{
      setNotice(!consent?'Rascunho disponível sem IA generativa. Autorize o Qwen para geração local.':
        'Qwen não carregado: '+(profile.reason||route.notice)+'. Rascunho determinístico mantido.');
    }
   }else{
    answer=mode==='peca'?buildPredictLmPetition({kind,instructions:userText}).body:offlineBlackholeReply(userText);
    model=mode==='peca'?'Minuta estruturada determinística · não protocolada':'Regras e evidências locais';
   }
   if(typeof answer!=='string'||!answer.trim())throw Error('Motor não retornou texto verificável.');
   setDraft(answer.slice(0,18000));
   setSource(model);
   if(engine==='deterministico')setNotice('Rascunho determinístico pronto. Nenhuma consulta judicial ou mensagem WhatsApp foi enviada.');
  }catch(error){setNotice('Não foi possível gerar: '+String(error.message||error).slice(0,240))}
  finally{setBusy(false)}
 }
 async function review(decision){
  if(!draft||!session?.user?.id||!reviewNote.trim())return setNotice('Registre o motivo da decisão antes de salvar.');
  setBusy(true);
  try{
   const {error}=await db.from('office_agent_runs').insert({
    owner_id:session.user.id,agent:'openbot-workspace',task:prompt.slice(0,300),
    mode:'manual',status:'review',external_actions:0,sources:[],
    result:{answer:draft.slice(0,18000),engine:source,decision,
       human_review:true,scope:'somente este rascunho',review_note:reviewNote.slice(0,450),
       whatsapp_sent:false,official_lookup_performed:false}
   });
   if(error)throw error;
   setApproved(decision==='approved');
   setNotice(decision==='approved'
    ?'Aprovado para uso manual e registrado. Não houve envio nem confirmação judicial.'
    :'Rejeitado e registrado. Nenhum envio foi realizado.');
  }catch(error){setNotice('Não foi possível registrar a revisão: '+String(error.message||error).slice(0,180))}
  finally{setBusy(false)}
 }
 return <section className="inf-panel" aria-label="Killa AI · gerar e revisar rascunhos" style={{marginTop:16}}>
  <div className={ui.shell}>
   <div className={ui.top}>
    <span className={ui.brand}><span className={ui.dot}/>KILLA <b>AI</b></span>
    <span className={ui.status}>{engine==='online'?'IA online · com autorização':localSelected?'Qwen local · opcional':'Motor leve · sem download'}</span>
   </div>
   <div className={ui.center}>
    <h2>Prepare sua resposta</h2>
    <p>Um pedido, um motor e um rascunho. Confira o resultado antes de copiar ou utilizar.</p>
   </div>
   <div className={ui.quickModes} role="group" aria-label="Tipo de trabalho">
    <button type="button" disabled={busy} aria-pressed={mode==='texto'}
     onClick={()=>{setMode('texto');setDraft('');setNotice('');setApproved(false)}}>Resposta ou resumo</button>
    <button type="button" disabled={busy} aria-pressed={mode==='peca'}
     onClick={()=>{setMode('peca');setDraft('');setNotice('');setApproved(false)}}>Minuta jurídica</button>
   </div>
   <label className={ui.quickField}>Motor da resposta
    <select aria-label="Motor da resposta" disabled={busy} value={engine} onChange={e=>{
     setEngine(e.target.value);setDraft('');setSource('');setNotice('');setApproved(false);
     if(e.target.value==='qwen4')setPreferCpu(false);
    }}>
     <option value="deterministico">Motor leve · regras e cálculos</option>
     <option value="online">IA online · escrever uma resposta livre</option>
     <option value="qwen">Qwen local · 0,5B</option>
     <option value="colibri-local">Colibri local · Qwen 0,5B</option>
     <option value="qwen17">Qwen3 1,7B · exige mais memória</option>
     <option value="qwen4">Qwen3 4B · exige GPU</option>
    </select>
   </label>
   {engine==='deterministico'&&<p className={ui.helper}>Respostas rápidas sem IA generativa. Para redigir mensagens livres, selecione IA online.</p>}
   {engine==='online'&&<label className={ui.quickConsent}><input type="checkbox" checked={onlineConsent} disabled={busy}
     onChange={e=>setOnlineConsent(e.target.checked)}/>Autorizo enviar somente este pedido ao provedor de IA externo configurado.</label>}
   {localSelected&&<label className={ui.quickConsent}><input type="checkbox" checked={consent} disabled={busy}
     onChange={e=>setConsent(e.target.checked)}/>Autorizo o download e a execução do Qwen neste navegador.</label>}
   {localSelected&&!consent&&<p className={ui.helper}>Sem esta autorização, o Killa mostra somente o rascunho feito por regras, sem carregar o Qwen.</p>}
   {mode==='peca'&&<label className={ui.quickField}>Tipo de peça
    <select disabled={busy} value={kind} onChange={e=>setKind(e.target.value)}>
     <option value="manifestacao">Manifestação</option><option value="peticao_inicial">Petição inicial</option>
     <option value="contestacao">Contestação</option><option value="recurso">Recurso · modalidade a conferir</option>
     <option value="relatorio">Relatório jurídico</option><option value="outro">Outro documento</option>
    </select>
   </label>}
   <div className={ui.composer}>
    <label htmlFor="killa-input" className={ui.srOnly}>Mensagem para Killa AI</label>
    <textarea id="killa-input" maxLength={3500} rows={4} disabled={busy}
     value={prompt} onChange={e=>setPrompt(e.target.value)}
     placeholder={mode==='peca'?'Descreva o objetivo, os fatos confirmados e a peça necessária.':'Escreva seu pedido. Ex.: redija uma resposta cordial a partir dos fatos que vou informar.'}/>
    <div className={ui.actions}>
     <span>{engine==='online'?'Modelo externo: somente com sua autorização':localSelected?'Modelo no seu aparelho · pode exigir download':'Modo rápido · não consulta tribunais'}</span>
     <button type="button" onClick={generate} disabled={busy||!prompt.trim()}>
      {busy?'Processando…':mode==='peca'?'Gerar minuta':'Gerar resposta'}</button>
    </div>
   </div>
   {busy&&localSelected&&<div className={ui.inlineActions}>
    <span className={ui.helper}>O rascunho leve fica disponível enquanto o Qwen processa.</span>
    <button type="button" onClick={()=>{stopBlackholeQwen();setNotice('Qwen interrompido. O texto inicial foi preservado.')}}>Parar Qwen</button>
   </div>}
   {notice&&<p role="status" className={ui.feedback}>{notice}</p>}
   {draft&&<article className={ui.answer}>
    <strong>Resposta para revisão</strong>
    <small>{source||'Origem não informada'}</small>
    <p>{draft}</p>
    <div className={ui.inlineActions}>
     <button type="button" onClick={()=>{
      if(!navigator.clipboard?.writeText){setNotice('Selecione o texto acima para copiar.');return}
      navigator.clipboard.writeText(draft).then(()=>setNotice('Resposta copiada. Nenhuma mensagem foi enviada.'))
       .catch(()=>setNotice('Selecione o texto acima para copiar.'));
     }}>Copiar resposta</button>
     {mode==='peca'&&<button type="button" onClick={()=>{
      const html=createLegalDocumentHtml({title:'Minuta '+kind.replace(/_/g,' '),body:draft});
      const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download='minuta-juridica-interna.html';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
     }}>Baixar minuta editável</button>}
    </div>
    <details className={ui.innerDisclosure}>
     <summary>Registrar revisão no CRM (opcional)</summary>
     <label className={ui.reviewLabel}>Motivo da revisão
      <textarea rows={2} maxLength={450} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}
       placeholder="Registre o que você conferiu e por que aprova ou rejeita o texto."/></label>
     <div className={ui.inlineActions}>
      <button type="button" disabled={busy||!reviewNote.trim()} onClick={()=>review('approved')}>Aprovar e registrar</button>
      <button type="button" disabled={busy||!reviewNote.trim()} onClick={()=>review('rejected')}>Rejeitar e registrar</button>
     </div>
     {approved&&<p>Revisão aprovada para uso manual, sem envio automático.</p>}
    </details>
   </article>}
  </div>
  <details className={ui.disclosure}>
   <summary>Modelo local opcional · desempenho e memória</summary>
   <p>O Qwen exige CPU ou GPU, memória livre e arquivos de modelo. Para evitar travamentos, ele só é carregado após você selecionar um modelo e autorizar o uso. Sem cota diária de tokens ou perguntas no modo local; o limite por resposta depende do aparelho.</p>
   {localSelected?<div className={ui.advancedGrid}>
    <label>GPU disponível (opcional)<input type="checkbox" checked={!preferCpu} disabled={busy||engine==='qwen4'}
     onChange={e=>setPreferCpu(!e.target.checked)}/></label>
    <label>Limite de geração
     <select value={tokenBudget} disabled={busy} onChange={e=>setTokenBudget(Number(e.target.value))}>
      {[128,256,384,512,768,1024,1536,2048].map(n=><option key={n} value={n}>{n} tokens</option>)}
     </select></label>
    <p>Cache: {cacheInfo?.complete?'Arquivos preparados no navegador.':
      cacheInfo?.cachedFiles>0?'Arquivos parciais disponíveis; o download pode continuar.':'Ainda não foi possível confirmar os arquivos do modelo.'}</p>
   </div>:<p>Selecione Qwen acima para mostrar as opções de desempenho.</p>}
  </details>
  <details className={ui.disclosure}>
   <summary>Linha do tempo jurídica · ferramenta extra</summary>
   <p>Uma data e um fato conferido por linha: DD/MM/AAAA | descrição.</p>
   <textarea rows={4} maxLength={1900} value={timelineEvents} onChange={e=>setTimelineEvents(e.target.value)}
    placeholder={'12/11/2026 | Documento juntado\n14/11/2026 | Processo encaminhado ao juiz'}/>
   <div className={ui.inlineActions}>
    <button type="button" onClick={()=>{
     try{setTimelineSvg(createLegalTimelineSvg({events:timelineEvents}));setNotice('Linha do tempo ilustrativa gerada; confira as datas.')}
     catch(e){setNotice(String(e.message||e))}
    }}>Gerar linha do tempo</button>
    {timelineSvg&&<button type="button" onClick={()=>{
     const url=URL.createObjectURL(new Blob([timelineSvg],{type:'image/svg+xml'}));
     const a=document.createElement('a');a.href=url;a.download='linha-do-tempo-ilustrativa.svg';a.click();
     setTimeout(()=>URL.revokeObjectURL(url),1000);
    }}>Baixar SVG</button>}
   </div>
   {timelineSvg&&<img alt="Linha do tempo ilustrativa não verificada" style={{maxWidth:'100%'}}
    src={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(timelineSvg)}/>}
  </details>
  <details className={ui.disclosure}>
   <summary>Integrações externas · WhatsApp e MCP</summary>
   <p>O MCP conecta assistentes externos com permissões próprias. Ele não configura o motor de resposta acima nem conecta o WhatsApp automaticamente.</p>
   <nav className={ui.links}>
    <a href="/mcp/setup">Configurar MCP</a>
    <a href="/whatsapp">Meu WhatsApp</a>
    <a href={ZAPFAST_SINGLE_SESSION_URL} target="_blank" rel="noopener noreferrer">Abrir ZapFast</a>
   </nav>
   <p>O WhatsApp exige uma sessão própria. Não vincule o mesmo número em dois motores ao mesmo tempo.</p>
  </details>
 </section>;
}
