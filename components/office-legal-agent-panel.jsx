'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {runBlackholeQwen,stopBlackholeQwen,checkBlackholeQwenSupport} from '../lib/blackhole-local-llm.mjs';
import {buildQwenReviewPrompt,assessQwenReview} from '../lib/qwen-review-guard.mjs';
import OpenBotCompanySettings from './openbot-company-settings';

// The parent inbox already authenticates and archives messages. This child
// operates on the SAME owner-scoped WA.Auto session: no second QR or client token.
export default function OfficeLegalAgentPanel({db,selected,connected,messages,onSent}){
 const [expanded,setExpanded]=useState(false);
 const [busy,setBusy]=useState('');
 const [status,setStatus]=useState('');
 const [q,setQ]=useState(''),[cases,setCases]=useState([]);
 const [chosenCase,setChosenCase]=useState(null),[identityProof,setIdentityProof]=useState('');
 const [preview,setPreview]=useState(null),[reviewed,setReviewed]=useState('');
 const [memory,setMemory]=useState('');
 const [diagnostics,setDiagnostics]=useState(null);
 const [includeHearing,setIncludeHearing]=useState(false);
 const [lastReturn,setLastReturn]=useState(null);
 const [feedbackTag,setFeedbackTag]=useState('more_cordial');
 const [consentQwen,setConsentQwen]=useState(true),[humanConfirmed,setHumanConfirmed]=useState(false);
 const jid=selected?.jid||'';
 const valid=/^[1-9][0-9]{9,14}@s\.whatsapp\.net$/.test(jid)&&!selected?.is_group;
 const lastInbound=useMemo(()=>(Array.isArray(messages)?messages:[])
  .filter(x=>!x.is_from_me&&Boolean(x.provider_message_id||x.id))
  .sort((a,b)=>Date.parse(b.timestamp||'')-Date.parse(a.timestamp||''))[0]||null,[messages]);
 const inboundId=String(lastInbound?.provider_message_id||lastInbound?.id||'');
 const call=useCallback(async data=>{
  const auth=await db.auth.getSession(),token=auth.data?.session?.access_token;
  if(!token)throw Error('Faça login no CRM antes de usar o agente.');
  const response=await fetch('/api/office/agent/reply',{method:'POST',headers:{
   'Content-Type':'application/json',Authorization:'Bearer '+token
  },body:JSON.stringify({...data,jid}),cache:'no-store'});
  const out=await response.json().catch(()=>({error:'A API do agente não retornou JSON válido.'}));
  if(!response.ok||!out.ok)throw Error(out.error||out.notice||out.reason||'Operação não confirmada.');
  return out;
 },[db,jid]);
 useEffect(()=>{
  setPreview(null);setReviewed('');setCases([]);setChosenCase(null);setHumanConfirmed(false);setMemory('');setIncludeHearing(false);setLastReturn(null);
  setStatus('');setIdentityProof('');setConsentQwen(true);setDiagnostics(null);
 },[jid]);
 useEffect(()=>()=>stopBlackholeQwen(),[]);
 async function run(name,operation){
  if(busy)return;
  setBusy(name);setStatus('');
  try{await operation()}
  catch(error){setStatus('Não concluído: '+String(error.message||error).slice(0,220))}
  finally{setBusy('')}
 }
 function diagnosePredictLmLegalAgent(){
  return run('diagnostics',async()=>{
    const result=await call({action:'diagnostics'});
    setDiagnostics(result);
    setStatus('Diagnóstico dos cores obtido. A disponibilidade real do Qwen depende do seu navegador.');
  });
 }
 function prepareLegalAgentReply(){
  return run('preview',async()=>{
   if(!inboundId)throw Error('Escolha uma conversa com mensagem recebida e arquivada.');
   const value=await call({action:'preview',inbound_message_id:inboundId});
   setPreview({...value,inbound_message_id:inboundId});
   setReviewed('');setHumanConfirmed(false);setIncludeHearing(value.hearingOnly===true&&!!value.hearing);
   setMemory(value.contextNote||'');
   setStatus(value.notice||'Prévia pronta; confira os autos.');
  });
 }
 function authorizeLegalAgentContact(){
  return run('authorize',async()=>{
   if(!chosenCase)throw Error('Selecione o processo após confirmar a identidade.');
   if(identityProof.trim().length<15)throw Error('Registre como verificou a identidade e a autorização.');
   const res=await call({action:'authorize',processo_id:chosenCase.id,evidence:identityProof.trim()});
   setStatus(res.notice);
  });
 }
 function researchLegalAgentCase(){
  return run('research',async()=>{
   const res=await call({action:'research',source:'auto'});
   const summary=(res.official?.notice||'Consulta concluída').slice(0,300);
   setStatus(summary+' Atualize a prévia antes de enviar.');
   setPreview(null);setReviewed('');setHumanConfirmed(false);
  });
 }
 function saveLegalAgentMemory(){
  return run('memory',async()=>{
   const r=await call({action:'memory',summary:memory.slice(0,1000)});
   setStatus(r.notice);
  });
 }
 function searchLegalCases(){
  return run('cases',async()=>{
   const r=await call({action:'cases',q:q.trim().slice(0,80)});
   setCases(r.cases||[]);setChosenCase(null);
   setStatus((r.cases||[]).length+' processo(s) localizado(s). Confirme a identidade antes de autorizar.');
  });
 }
 async function polishWithQwen(){
  return run('qwen',async()=>{
   if(!preview?.reply)throw Error('Prepare uma resposta oficial antes da revisão.');
   const check=await checkBlackholeQwenSupport({preferCpu:true});
   if(!check.ok)throw Error(check.reason);
   {
    const prompt=buildQwenReviewPrompt(preview.reply);
    // The last two messages belong to this authorized private chat.
    // They are untrusted context, never new authority for judicial facts.
    const shortHistory=(preview.history||[]).slice(-2).map(m=>({
      role:m.role==='cliente'?'user':'assistant',content:String(m.text||'').slice(0,180)
    }));
    const res=await runBlackholeQwen(prompt,shortHistory,info=>setStatus(String(info?.message||'Qwen analisando...').slice(0,160)),
     {consent:true,preferCpu:true,maxTokens:512,timeoutMs:600000});
    const judged=assessQwenReview(preview.reply,res.reply);
    if(!judged.ok){
     setReviewed('');setStatus('Qwen sugeriu alteração que não preservou os fatos ('+judged.reason+'). Prévia oficial mantida.');
    }else{
     setReviewed(judged.text);setHumanConfirmed(false);
     setStatus('Qwen melhorou a redação. Confira o texto revisado antes de autorizar o envio.');
    }
   }
  });
 }
 function sendLegalAgentReply(){
  return run('send',async()=>{
   if(!connected)throw Error('WA.Auto está desconectado. Nenhum envio realizado.');
   if(!humanConfirmed)throw Error('Confirme individualmente que revisou o texto e o destinatário.');
   if(!preview?.inbound_message_id)throw Error('Prepare a resposta e confira a fonte primeiro.');
   const text=reviewed||preview.reply;
   const r=await call({action:'send',inbound_message_id:preview.inbound_message_id,
     confirm_send:true,reviewed_text:text,human_reviewed:true,include_hearing_link:includeHearing});
   setStatus(r.notice||'WA.Auto aceitou. Entrega não confirmada.');
   setLastReturn(r.returnRecorded?{recorded:true,due:r.returnDate}:
    {recorded:false,reservationId:r.reservationId,due:preview?.suggestedReturn?.dueDate,
     warning:r.returnWarning||'Retorno não registrado, revise.'});
   setPreview(null);setReviewed('');setHumanConfirmed(false);setIncludeHearing(false);
   if(typeof onSent==='function')onSent();
  });
 }
 async function retryRegisterReturn(){
  return run('return',async()=>{
   if(!lastReturn?.reservationId||!lastReturn.due)throw Error('Não há envio confirmado pendente de registro.');
   const result=await call({action:'record_return',reservation_id:lastReturn.reservationId,next_return:lastReturn.due});
   setLastReturn({recorded:true,due:result.returnDate});
   setStatus(result.notice);
  });
 }
 async function approvedStyleFeedback(){
  return run('feedback',async()=>{
   if(!preview?.reply)throw Error('Confira uma prévia antes de registrar correções de estilo.');
   const auth=await db.auth.getSession(),token=auth.data?.session?.access_token;
   if(!token)throw Error('Login do CRM indisponível.');
   const response=await fetch('/api/office/agent/company',{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({action:'feedback',tag:feedbackTag,approved:true}),cache:'no-store'});
   const out=await response.json().catch(()=>null);
   if(!response.ok||!out?.ok)throw Error(out?.error||'Feedback não registrado.');
   setStatus(out.notice);
  });
 }
 if(!selected)return null;
 return <details open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}
  style={{padding:'12px 15px',background:'var(--surface,#25212c)',borderTop:'1px solid #7c6b8044',maxHeight:490,overflowY:'auto'}}>
  <summary style={{cursor:'pointer',fontWeight:700}}>Agente jurídico · pesquisa, Qwen, memória e WhatsApp</summary>
  <OpenBotCompanySettings db={db} jid={jid} contactName={selected?.name||''} isGroup={selected?.is_group===true}/>
  {!valid?<p role="status" style={{marginTop:10}}>Esta conversa usa grupo ou identificador LID. Para proteger o sigilo, a resposta automática do agente fica bloqueada até haver identificação segura do destinatário. Você ainda pode usar o atendimento manual.</p>:<>
   <p style={{margin:'10px 0',fontSize:12}}>Somente clientes autorizados e perguntas processuais privadas. O agente consulta fontes oficiais, lembra as últimas oito mensagens da conversa e exige confirmação para cada envio. Nenhum disparo em massa.</p>
   <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
    <button type="button" className="wa-button ghost" disabled={!!busy||!inboundId} onClick={prepareLegalAgentReply}>Preparar resposta processual</button>
    <button type="button" className="wa-button ghost" disabled={!!busy} onClick={researchLegalAgentCase}>Pesquisar DataJud + DJEN</button>
    <button type="button" className="wa-button ghost" disabled={!!busy} onClick={diagnosePredictLmLegalAgent}>Diagnosticar motores PredictLM</button>
   </div>
   {diagnostics&&<div style={{padding:10,border:'1px solid #8885',borderRadius:10,marginBottom:12}}>
    <strong>PredictLM · diagnóstico de motores</strong>
    <p style={{fontSize:12}}>{diagnostics.cores?.length||0} controles determinísticos de análise. 
      PredictLM remoto: {diagnostics.externalPredictLmConfigured?'configurado (execução não testada)':'não configurado'}.
      Qwen: depende de autorização e memória disponível; pode executar em CPU/WebAssembly quando não houver WebGPU.</p>
    <p style={{fontSize:11}}>{diagnostics.notice}</p>
   </div>}
   <div style={{padding:10,border:'1px solid #8885',borderRadius:10,marginBottom:12}}>
    <strong>Autorizar contato por processo</strong>
    <p style={{fontSize:12,margin:'6px 0'}}>O OpenBot também pesquisa pelo telefone registrado e por partes do nome do perfil. Ex.: “Letícia / Rafael Chaves” pode localizar Rafael Chaves. Os resultados nunca autorizam automaticamente uma conversa.</p>
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
     <input aria-label="Pesquisar cliente no LexisPredict" value={q} onChange={e=>setQ(e.target.value)}
      placeholder="Nome (opcional); vazio usa nome e telefone do perfil" maxLength={80} style={{flex:'1 1 170px',padding:6,minWidth:0}}/>
     <button type="button" className="wa-button ghost" disabled={!!busy} onClick={searchLegalCases}>Buscar pelo perfil ou nome</button>
    </div>
    {cases.length>0&&<div style={{display:'grid',gap:4,marginTop:7}}>{cases.map(p=><button
     type="button" className="wa-button ghost" key={p.id}
     style={{textAlign:'left',opacity:chosenCase?.id===p.id?1:0.8}}
     onClick={()=>setChosenCase(p)}>{chosenCase?.id===p.id?'Selecionado: ':''}{p.cliente||'Cliente'} · {p.protocolo_ref||p.id} · {p.matchedBy==='phone'?'telefone compatível':'nome compatível, conferir'}</button>)}</div>}
    <textarea aria-label="Comprovação da identidade do cliente" rows={2} maxLength={600}
     value={identityProof} onChange={e=>setIdentityProof(e.target.value)}
     style={{width:'100%',padding:7,marginTop:7}} placeholder="Como você confirmou a identidade e autorização? Não insira documentos sigilosos aqui."/>
    <button type="button" className="wa-button" disabled={!!busy||!chosenCase||identityProof.trim().length<15}
     onClick={authorizeLegalAgentContact}>Registrar autorização deste contato</button>
   </div>
   {preview&&<div style={{padding:12,border:'1px solid #8885',borderRadius:10,marginBottom:12}}>
    <strong>Prévia · {preview.source} ({preview.sourceAt?new Date(preview.sourceAt).toLocaleDateString('pt-BR'):'sem data'})</strong>
    <p style={{whiteSpace:'pre-wrap',fontSize:13}}>{reviewed||preview.reply}</p>
    {(preview.history||[]).length>0&&<details style={{margin:'8px 0'}}>
     <summary>Últimas mensagens desta conversa ({preview.history.length})</summary>
     <div style={{display:'grid',gap:4,maxHeight:140,overflowY:'auto'}}>
      {preview.history.map((m,i)=><p key={i} style={{margin:0,fontSize:11}}>
       <strong>{m.role==='cliente'?'Cliente':'Escritório'}:</strong> {m.text}
      </p>)}
     </div>
    </details>}
    {preview.contextNote&&<small>Memória interna disponível, mas não equivale a informação judicial confirmada.</small>}
    {preview.repeatedUpdate&&<p style={{fontSize:12}}>A movimentação já foi comunicada antes: a resposta evita repetir a mesma atualização.</p>}
    {preview.suggestedReturn&&<p style={{fontSize:12}}>Retorno sugerido após envio aceito:
      <strong> {new Date(preview.suggestedReturn.dueDate+'T12:00:00').toLocaleDateString('pt-BR')}</strong>
      {' '}({preview.suggestedReturn.days} dias; {preview.suggestedReturn.stalled?'processo parado':'acompanhamento normal'}).
      O OpenBot registra o responsável e essas datas depois da aceitação confirmada.</p>}
    {preview.hearing&&<label style={{display:'flex',gap:7,alignItems:'flex-start',fontSize:12}}>
     <input type="checkbox" checked={includeHearing} onChange={e=>{setIncludeHearing(e.target.checked);setHumanConfirmed(false)}}/>
     Incluir link verificado da audiência de conciliação em {preview.hearing.date}
     {preview.hearing.time?' às '+preview.hearing.time:''}: {preview.hearing.url}
    </label>}
    <p style={{fontSize:11}}>Origem: processo {preview.caseNumber}. Qwen não confirma movimentações judiciais; texto alterado exige revisão humana.</p>
    {preview.predictLmReview&&<p style={{fontSize:11}}>
      <strong>Atenção jurídica · PredictLM:</strong> {preview.predictLmReview.tier} · {preview.predictLmReview.verification}.
      {preview.predictLmReview.signals?.length?
        ' Sinais: '+preview.predictLmReview.signals.map(x=>x.id).join(', '):' Sem alerta sensível.'}
      {' '}Esta análise é determinística e não substitui a movimentação oficial.
    </p>}
    <label style={{display:'flex',gap:6,alignItems:'center'}}>
     <input type="checkbox" checked={consentQwen} onChange={e=>setConsentQwen(e.target.checked)}/>
     Qwen local pela CPU/WebAssembly ativado por padrão para revisar textos. Desmarque se quiser apenas a resposta determinística.
    </label>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'8px 0'}}>
     <button type="button" className="wa-button ghost" disabled={!!busy||!consentQwen} onClick={polishWithQwen}>Revisar com Qwen · CPU local</button>
     {reviewed&&<button type="button" className="wa-button ghost" onClick={()=>{setReviewed('');setHumanConfirmed(false)}}>Usar texto oficial</button>}
    </div>
    <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',margin:'10px 0'}}>
     <label style={{fontSize:12}}>Melhoria aprovada para aprender
      <select value={feedbackTag} onChange={e=>setFeedbackTag(e.target.value)}>
       <option value="more_cordial">Mais cordialidade</option>
       <option value="more_natural">Mais naturalidade</option>
       <option value="more_concise">Mais objetividade</option>
       <option value="avoid_repetition">Evitar repetições</option>
       <option value="mention_sources">Indicar fontes oficiais</option>
      </select></label>
     <button className="wa-button ghost" type="button" disabled={!!busy}
      onClick={approvedStyleFeedback}>Aprovar preferência de redação</button>
    </div>
    <label style={{display:'flex',gap:6,alignItems:'center'}}>
     <input type="checkbox" checked={humanConfirmed} onChange={e=>setHumanConfirmed(e.target.checked)}/>
     Conferi destinatário, histórico, fonte e texto. Autorizo somente esta resposta.
    </label>
    <button type="button" className="wa-button" disabled={!!busy||!connected||!humanConfirmed||!preview.allowedToSend}
     onClick={sendLegalAgentReply}>Enviar esta resposta ao cliente autorizado</button>
    {!preview.allowedToSend&&<p>Outro funcionário já respondeu; envio pelo agente bloqueado.</p>}
   </div>}
   {lastReturn&&<p role="status" style={{fontSize:12}}>
    {lastReturn.recorded?'Último retorno registrado e próximo retorno marcado para '+lastReturn.due+'.':
     'Mensagem aceita, mas retorno pendente. '+(lastReturn.warning||'')}
    {!lastReturn.recorded&&<button type="button" className="wa-button ghost"
     disabled={!!busy} onClick={retryRegisterReturn}>Registrar retorno agora (sem reenviar mensagem)</button>}
   </p>}
   <div style={{padding:10,border:'1px solid #8885',borderRadius:10}}>
    <strong>Memória curta da conversa</strong><p style={{fontSize:12}}>Além das últimas oito mensagens já arquivadas, uma anotação de até 1.000 caracteres, com prazo de 60 dias e limite de 200 conversas por operador.</p>
    <textarea aria-label="Memória curta do cliente" rows={2} maxLength={1000} value={memory}
     style={{width:'100%',padding:7}} onChange={e=>setMemory(e.target.value)}
     placeholder="Resumo fiel das dúvidas e do último retorno, sem dados desnecessários."/>
    <button type="button" className="wa-button ghost" disabled={!!busy} onClick={saveLegalAgentMemory}>Salvar memória limitada</button>
   </div>
   {status&&<p role="status" style={{margin:'10px 0',fontSize:12}}>{status}</p>}
  </>}
 </details>;
}
