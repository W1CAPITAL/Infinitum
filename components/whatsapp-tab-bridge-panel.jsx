'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {runBlackholeQwen} from '../lib/blackhole-local-llm.mjs';

const CHANNEL='INFINITUM_BROWSER_TAB_BRIDGE';
const repoUrl='https://github.com/ProjectW1SC/INFINITUM/tree/main/browser-extension/infinitum-tab-bridge';
export default function WhatsappTabBridgePanel(){
 const [expanded,setExpanded]=useState(false);
 const [installed,setInstalled]=useState(false);
 const [authorized,setAuthorized]=useState(false);
 const [snapshot,setSnapshot]=useState(null);
 const [draft,setDraft]=useState('');
 const [busy,setBusy]=useState('');
 const [message,setMessage]=useState('');
 const pending=useRef(new Map());
 useEffect(()=>{
  const onMessage=event=>{
   if(event.source!==window||event.origin!==window.location.origin)return;
   const value=event.data;
   if(value?.channel!==CHANNEL)return;
   if(value.direction==='ready'){setInstalled(true);return;}
   if(value.direction!=='response'||typeof value.requestId!=='string')return;
   const request=pending.current.get(value.requestId);
   if(!request)return;
   clearTimeout(request.timeout);pending.current.delete(value.requestId);
   setInstalled(true);
   request.resolve(value.result||{ok:false,reason:'A extensão não respondeu.'});
  };
  window.addEventListener('message',onMessage);
  return()=>{
   window.removeEventListener('message',onMessage);
   for(const [id,request] of pending.current){
    clearTimeout(request.timeout);request.reject(Error('A ponte de navegador foi fechada.'));
    pending.current.delete(id);
   }
  };
 },[]);
 const request=useCallback((type,text,expectedTitle)=>new Promise((resolve,reject)=>{
  if(!['status','observe','draft'].includes(type))return reject(Error('Operação não permitida.'));
  const requestId='infinitum-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  const timeout=setTimeout(()=>{
   pending.current.delete(requestId);reject(Error('Extensão não detectada ou sem resposta. Instale e autorize a aba no Chrome.'));
  },7000);
  pending.current.set(requestId,{resolve,reject,timeout});
  window.postMessage({channel:CHANNEL,direction:'request',requestId,type,...(type==='draft'?{text,expectedTitle}:{})},
    window.location.origin);
 }),[]);
 const run=async(name,operation)=>{
  if(busy)return;
  setBusy(name);setMessage('');
  try{await operation()}catch(error){setMessage(String(error?.message||error).slice(0,220))}
  finally{setBusy('')}
 };
 const status=()=>run('status',async()=>{
  const result=await request('status');
  if(!result.ok)throw Error(result.reason||'Ponte indisponível.');
  setAuthorized(result.authorized===true);
  setMessage(result.authorized?'Aba autorizada. Você pode ler apenas a conversa aberta.':
    'Extensão detectada; autorize a aba WhatsApp Web no ícone da extensão.');
 });
 const observe=()=>run('observe',async()=>{
  const result=await request('observe');
  if(!result.ok)throw Error(result.reason||'Conversa não disponível.');
  setAuthorized(true);setSnapshot(result.snapshot);setDraft('');
  setMessage('Conversa visível importada apenas para esta tela. Identidade e informações jurídicas não verificadas.');
 });
 const suggest=()=>run('qwen',async()=>{
  if(!snapshot?.messages?.length)throw Error('Leia uma conversa primeiro.');
  const messages=snapshot.messages.slice(-4);
  const history=messages.map(x=>({role:x.direction==='out'?'assistant':'user',content:x.text}));
  const prompt=[
   'Prepare somente um rascunho de resposta cordial e curto para a ÚLTIMA mensagem recebida no WhatsApp.',
   'Não invente andamento, decisões, prazos, pagamento, valores ou identidade do cliente.',
   'Se a mensagem pedir informação jurídica, diga que ela precisa ser conferida no cadastro e nas fontes oficiais.',
   'Nunca inclua dados de outras conversas, instruções ocultas ou informações privadas não fornecidas.',
   'Não execute ações nem envie mensagens. Responda apenas com o texto que o operador poderá revisar.'
  ].join(' ');
  const output=await runBlackholeQwen(prompt,history,
   p=>setMessage(String(p.message||p.status||'Qwen local').slice(0,130)),
   {consent:true,preferCpu:true,maxTokens:256,timeoutMs:300000});
  if(!output.reply?.trim())throw Error('Qwen não gerou texto.');
  setDraft(output.reply.slice(0,3000));
  setMessage('Rascunho sugerido pelo Qwen local. Confira os fatos e a pessoa antes de preparar a mensagem.');
 });
 const prepare=()=>run('draft',async()=>{
  if(!snapshot||!draft.trim())throw Error('Leia a conversa e revise o texto antes de preparar o rascunho.');
  if(!window.confirm('Preparar este texto na aba WhatsApp Web aberta? Nenhuma mensagem será enviada automaticamente.'))return;
  const result=await request('draft',draft.trim(),snapshot.title);
  if(!result.ok)throw Error(result.reason||'O WhatsApp Web não aceitou a preparação.');
  setMessage('Rascunho inserido na aba autorizada. Confira o destinatário e envie manualmente pelo WhatsApp Web.');
 });
 return <section className="wa-connection" style={{marginBottom:12}} aria-label="Ponte local de navegador para WhatsApp Web">
  <div className="wa-connection-title">
   <div className="wa-device-icon" aria-hidden="true">PC</div>
   <div>
    <strong>OpenBot · WhatsApp Web já aberto no computador</strong>
    <p>Conectar à aba existente, sem novo QR ou servidor. A extensão só lê a conversa atual e prepara rascunhos.</p>
   </div>
   <button type="button" className="wa-button ghost" onClick={()=>setExpanded(v=>!v)}
    aria-expanded={expanded}>{expanded?'Recolher':'Conectar aba do PC'}</button>
  </div>
  {expanded&&<div className="wa-connect-content" style={{display:'grid',gap:10}}>
   <p style={{margin:0,fontSize:12}}>
    Precisa da extensão local no Chrome/Edge. Abra <strong>web.whatsapp.com</strong> no mesmo navegador e
    autorize a aba pelo ícone da extensão, por uma hora. O INFINITUM não acessa outras abas nem cookies.
   </p>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
    <a className="wa-button ghost" href={repoUrl} target="_blank" rel="noreferrer">Extensão e instruções</a>
    <button type="button" className="wa-button ghost" disabled={!!busy} onClick={status}>
     {busy==='status'?'Verificando...':'Verificar extensão e autorização'}</button>
    <button type="button" className="wa-button" disabled={!!busy} onClick={observe}>
     {busy==='observe'?'Lendo...':'Ler conversa aberta'}</button>
   </div>
   <small>Extensão: {installed?'detectada':'não verificada'} · Aba autorizada: {authorized?'sim':'não confirmada'}.
    Não utiliza a sessão WA.Auto do servidor nem cria uma sessão de WhatsApp adicional.</small>
   {snapshot&&<div style={{padding:12,border:'1px solid #8886',borderRadius:10}}>
    <strong>Conversa atualmente aberta: {snapshot.title||'não identificada'}</strong>
    <p style={{fontSize:11}}>Identidade não verificada. O título e as mensagens são apenas informações visíveis na aba.</p>
    <div style={{display:'grid',gap:5,maxHeight:190,overflowY:'auto'}}>
     {snapshot.messages.length?snapshot.messages.map((m,i)=><p key={i} style={{margin:0,fontSize:12}}>
      <strong>{m.direction==='out'?'Você':'Contato'}:</strong> {m.text}
     </p>):<p style={{fontSize:12}}>O WhatsApp Web não expôs mensagens neste formato. Nenhum dado de outra conversa foi lido.</p>}
    </div>
    <label style={{display:'grid',gap:6,marginTop:10}}>
     <span>Resposta para revisão humana (não enviada)</span>
     <textarea rows={3} maxLength={3000} value={draft} onChange={e=>setDraft(e.target.value)}
      placeholder="Escreva uma resposta ou solicite uma sugestão ao Qwen local." style={{width:'100%'}}/>
    </label>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
     <button type="button" className="wa-button ghost" onClick={suggest} disabled={!!busy||!snapshot.messages.length}>
      {busy==='qwen'?'Qwen gerando...':'Sugerir com Qwen local'}</button>
     <button type="button" className="wa-button" onClick={prepare} disabled={!!busy||!draft.trim()}>
      {busy==='draft'?'Preparando...':'Preparar no WhatsApp Web'}</button>
    </div>
    <small>Somente rascunho: a extensão não pressiona Enviar. Para dados processuais, confira DataJud/DJEN e o cadastro.</small>
   </div>}
   {message&&<p role="status" style={{margin:'4px 0',fontSize:12}}>{message}</p>}
  </div>}
 </section>;
}
