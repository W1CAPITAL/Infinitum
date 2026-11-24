'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {Bot,Plus,PanelLeftClose,PanelLeftOpen,PanelRightClose,PanelRightOpen,MessageSquare,Search,Send,
 ShieldCheck,SlidersHorizontal,Activity,Clock3,Plug,Monitor,ArrowLeft,Trash2,CheckCircle2,AlertTriangle,
 ExternalLink,LoaderCircle,FileText,RefreshCw,Copy,RotateCcw} from 'lucide-react';
import {OPENBOT_BOTS,OPENBOT_CAPABILITIES,OPENBOT_APPROVAL,findOpenBot,chatTitle,
 historyForRequest,prepareBotRequest} from '../lib/openbot-studio-config.mjs';
import {mergeHistory,allowsExternalFallback} from '../lib/infinitum-agent-policy.mjs';
import {ZAPFAST_SINGLE_SESSION_URL} from '../lib/openbot-workspace-policy.mjs';
import styles from './openbot-studio.module.css';
import OpenBotConnectedApps from './openbot-connected-apps.jsx';

const starterModels=[{id:'rules',label:'Rascunho rápido (sem IA generativa)',mode:'rules'}];
const timeLabel=value=>{
 const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
};
const dateLabel=value=>{
 const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
};
const safeError=e=>String(e?.message||e||'Operação não concluída').slice(0,260);
const validTitle=t=>chatTitle(t).slice(0,120);
const openbotLabel=id=>OPENBOT_BOTS.find(b=>b.key===id)?.name||'Killa';

export default function OpenBotStudio({db,session,initialBot,initialThreadId,startNew=false,embedded=false,onBack,activityRuns=[]}){
 const owner=session?.user?.id;
 const [models,setModels]=useState(starterModels);
 const [threads,setThreads]=useState([]),[profiles,setProfiles]=useState({});
 const [activeBot,setActiveBot]=useState(initialBot||'killa'),[thread,setThread]=useState(null);
 const [messages,setMessages]=useState([]),[draft,setDraft]=useState('');
 const [selectedModel,setSelectedModel]=useState('rules');
 const [onlineConsent,setOnlineConsent]=useState(false),[localConsent,setLocalConsent]=useState(false),[fallbackConsent,setFallbackConsent]=useState(false);
 const [historyOffset,setHistoryOffset]=useState(250),[hasOlder,setHasOlder]=useState(false),[olderLoading,setOlderLoading]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loadingChat,setLoadingChat]=useState(false),[sidebarReady,setSidebarReady]=useState(false);
 const [notice,setNotice]=useState(''),[error,setError]=useState('');
 const [search,setSearch]=useState(''),[panel,setPanel]=useState('sobre'),[inspector,setInspector]=useState(true);
 const [mobileBots,setMobileBots]=useState(false),[settingsOpen,setSettingsOpen]=useState(false);
 const [customInstruction,setCustomInstruction]=useState(''),[savingSettings,setSavingSettings]=useState(false);
 const [pendingDelete,setPendingDelete]=useState(false);
 const [appsOpen,setAppsOpen]=useState(false);
 const [appsDefaultTab,setAppsDefaultTab]=useState('apps');
 const bottomRef=useRef(null),editorRef=useRef(null),sendLock=useRef(false),chatRequest=useRef(0),initialOpenedRef=useRef(false);
 const bot=findOpenBot(activeBot);
 const profile=profiles[activeBot]||null;
 const visibleThreads=useMemo(()=>threads.filter(x=>
  [x.title,openbotLabel(x.bot_key)].some(v=>String(v||'').toLocaleLowerCase('pt-BR')
   .includes(search.trim().toLocaleLowerCase('pt-BR')))),[threads,search]);
 const currentMode=models.find(x=>x.id===selectedModel)?.mode||'rules';
 const online=currentMode==='online',local=currentMode==='local';
 const consentReady=(!online||onlineConsent)&&(!local||localConsent);

 const getToken=useCallback(async()=>{
  const {data,error:e}=await db.auth.getSession();
  if(e||!data?.session?.access_token)throw Error('Sua sessão expirou. Entre novamente no INFINITUM.');
  return data.session.access_token;
 },[db]);

 const api=useCallback(async(path,options={})=>{
  const token=await getToken();
  // The signed Windows client has a local server without the private OAuth/AI keys.
  // The authenticated relay forwards only selected endpoints to the canonical HTTPS backend.
  const desktop=typeof window!=='undefined'&&window.killaDesktop&&window.location.hostname==='127.0.0.1';
  const endpoint=desktop?'/api/openbot/relay?path='+encodeURIComponent(path):path;
  const r=await fetch(endpoint,{...options,cache:'no-store',headers:{
   Authorization:'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})
  }});
  const j=await r.json().catch(()=>({ok:false,error:'Resposta do servidor inválida.'}));
  if(!r.ok||!j.ok)throw Error(j.error||'Servidor indisponível.');
  return j;
 },[getToken]);

 const loadSidebar=useCallback(async()=>{
  if(!owner)return;
  const [t,p]=await Promise.all([
   db.from('openbot_threads').select('id,bot_key,title,model,updated_at,created_at').eq('owner_id',owner)
    .order('updated_at',{ascending:false}).limit(100),
   db.from('openbot_profiles').select('bot_key,instructions,model').eq('owner_id',owner).limit(30)
  ]);
  if(t.error||p.error)throw Error(t.error?.message||p.error?.message||'Histórico indisponível.');
  const threadRows=t.data||[];setThreads(threadRows);
  const overrides={};for(const q of p.data||[])overrides[q.bot_key]={instructions:q.instructions||'',model:q.model||'rules'};
  setProfiles(overrides);
  return threadRows;
 },[db,owner]);

 useEffect(()=>{
  if(!owner){setLoading(false);setSidebarReady(true);return;}
  let alive=true;
  (async()=>{
   setLoading(true);setError('');
   const results=await Promise.allSettled([loadSidebar(),api('/api/openbot/models')]);
   if(!alive)return;
   if(results[0].status==='rejected')setError('Não foi possível carregar suas conversas: '+safeError(results[0].reason));
   if(results[1].status==='fulfilled'){
    const available=results[1].value.models||starterModels;setModels(available);
    if(available.some(m=>m.mode==='online'))setSelectedModel('auto');
   }else setNotice('Modelos online não puderam ser verificados. Os recursos locais continuam disponíveis.');
   setLoading(false);setSidebarReady(true);
  })();
  return()=>{alive=false};
 },[owner,loadSidebar,api]);

 useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth',block:'end'})},[messages.length,busy]);
 useEffect(()=>{setCustomInstruction(profile?.instructions||'')},[activeBot,profile?.instructions]);

 async function openThread(x){
  if(busy)return;
  const seq=++chatRequest.current;setLoadingChat(true);setError('');setNotice('');setPendingDelete(false);
  setThread(x);setActiveBot(x.bot_key);setMessages([]);setDraft('');setOnlineConsent(false);setLocalConsent(false);setFallbackConsent(false);setHistoryOffset(250);setHasOlder(false);
  setSelectedModel(models.some(m=>m.id===x.model)?x.model:'rules');
  setMobileBots(false);
  const r=await db.from('openbot_messages').select('id,role,content,source,created_at')
   .eq('owner_id',owner).eq('thread_id',x.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(250);
  if(seq!==chatRequest.current)return;
  if(r.error){setMessages([]);setError('Não foi possível abrir o histórico: '+r.error.message)}
  else {const rows=r.data||[];setMessages(mergeHistory([],rows));setHasOlder(rows.length===250);}
  setLoadingChat(false);
 }

 async function loadOlder(){
  if(!thread||olderLoading||!hasOlder||busy)return;
  const seq=chatRequest.current;setOlderLoading(true);
  try{const result=await db.from('openbot_messages').select('id,role,content,source,created_at').eq('owner_id',owner).eq('thread_id',thread.id).order('created_at',{ascending:false}).order('id',{ascending:false}).range(historyOffset,historyOffset+249);
   if(result.error)throw result.error;if(seq!==chatRequest.current)return;
   const rows=result.data||[];setMessages(old=>mergeHistory(old,rows));setHistoryOffset(n=>n+rows.length);setHasOlder(rows.length===250&&historyOffset+rows.length<5000);
  }catch(e){if(seq===chatRequest.current)setError('Histórico anterior indisponível: '+safeError(e))}finally{setOlderLoading(false)}
 }
 function newConversation(botKey=activeBot){
  if(busy)return;
  ++chatRequest.current;setThread(null);setMessages([]);setDraft('');setError('');setNotice('');setLoadingChat(false);setOnlineConsent(false);setLocalConsent(false);setFallbackConsent(false);setHistoryOffset(250);setHasOlder(false);
  setPendingDelete(false);setActiveBot(botKey);setMobileBots(false);
  const defaultModel=profiles[botKey]?.model||'auto';
  setSelectedModel(models.some(x=>x.id===defaultModel)?defaultModel:(models.some(x=>x.id==='auto')?'auto':'rules'));
  editorRef.current?.focus();
 }
 function chooseBot(key){
  const last=threads.find(x=>x.bot_key===key);
  if(last)openThread(last);else newConversation(key);
 }

 useEffect(()=>{
  if(!embedded||!sidebarReady||initialOpenedRef.current)return;
  initialOpenedRef.current=true;
  const requested=OPENBOT_BOTS.some(item=>item.key===initialBot)?initialBot:'killa';
  const exact=initialThreadId?threads.find(item=>item.id===initialThreadId&&item.bot_key===requested):null;
  const latest=!startNew&&!exact?threads.find(item=>item.bot_key===requested):null;
  const target=exact||latest;
  if(target)void openThread(target);
  else newConversation(requested);
 },[embedded,sidebarReady,initialBot,initialThreadId,startNew,threads]);

 async function changeModel(model){
  if(busy)return;
  setSelectedModel(model);setError('');setNotice('');
  if(!thread)return;
  const result=await db.from('openbot_threads').update({model,updated_at:new Date().toISOString()})
   .eq('id',thread.id).eq('owner_id',owner);
  if(result.error){setNotice('Não foi possível salvar o motor da conversa: '+result.error.message);return}
  setThread(old=>old?{...old,model}:old);
  setThreads(old=>old.map(x=>x.id===thread.id?{...x,model}:x));
 }

 async function saveProfile(){
  if(savingSettings)return;setSavingSettings(true);setError('');setNotice('');
  try{
   const payload={owner_id:owner,bot_key:activeBot,instructions:customInstruction.trim().slice(0,1400),
    model:selectedModel,updated_at:new Date().toISOString()};
   const r=await db.from('openbot_profiles').upsert(payload,{onConflict:'owner_id,bot_key'});
   if(r.error)throw r.error;
   setProfiles(x=>({...x,[activeBot]:{instructions:payload.instructions,model:payload.model}}));
   setNotice('Preferências salvas neste usuário. Nenhum motor foi iniciado automaticamente.');
   setSettingsOpen(false);
  }catch(e){setError('Preferências não foram salvas: '+safeError(e))}
  finally{setSavingSettings(false)}
 }

 async function removeThread(){
  if(!thread||busy)return;
  if(!pendingDelete){setPendingDelete(true);return}
  const id=thread.id;
  const result=await db.from('openbot_threads').delete().eq('id',id).eq('owner_id',owner);
  if(result.error){setError('Não foi possível excluir a conversa: '+result.error.message);return}
  setThreads(old=>old.filter(t=>t.id!==id));
  newConversation(activeBot);
  setNotice('Conversa apagada do Supabase. Esta ação não interfere no WhatsApp.');
 }

 async function send(event){
  event?.preventDefault();
  const text=draft.trim().slice(0,3200);
  if(!text||!consentReady||busy||sendLock.current||loadingChat)return;
  sendLock.current=true;setBusy(true);setError('');setNotice('');
  let active=thread;
  try{
   if(!active){
    const created=await db.from('openbot_threads').insert({
     owner_id:owner,bot_key:activeBot,title:validTitle(text),model:selectedModel
    }).select('id,bot_key,title,model,updated_at,created_at').single();
    if(created.error||!created.data)throw Error(created.error?.message||'A conversa não foi criada.');
    active=created.data;setThread(active);setThreads(old=>[active,...old]);
   }
   const savedUser=await db.from('openbot_messages').insert({
    owner_id:owner,thread_id:active.id,role:'user',content:text,source:'operador'
   }).select('id,role,content,source,created_at').single();
   if(savedUser.error||!savedUser.data)throw Error(savedUser.error?.message||'Falha ao salvar sua mensagem.');
   setMessages(old=>[...old,savedUser.data]);setDraft('');
   let reply='',source='',note='';
   if(selectedModel==='rules'){
    const {offlineBlackholeReply}=await import('../lib/blackhole-chat.mjs');
    reply=offlineBlackholeReply(text);source='Motor de regras';note='Resposta por regras, sem modelo generativo ou consulta a fontes externas.';
   }else if(selectedModel==='qwen'){
    if(!localConsent)throw Error('Autorize o processamento local antes de executar o Qwen.');
    const {runBlackholeQwen,checkBlackholeQwenSupport}=await import('../lib/blackhole-local-llm.mjs');
    const {resolveLocalQwenModel}=await import('../lib/local-qwen-runtime.mjs');
    const modelId=resolveLocalQwenModel('qwen');
    const support=await checkBlackholeQwenSupport({preferCpu:true,modelId});
    if(!support.ok)throw Error('Qwen indisponível neste aparelho: '+support.reason);
    const out=await runBlackholeQwen(prepareBotRequest(activeBot,text,profile?.instructions),
     historyForRequest(messages),progress=>setNotice(String(progress.message||progress.status||'Processando modelo local…')),
     {consent:true,maxTokens:384,timeoutMs:180000,preferCpu:true,modelId});
    reply=out.reply;source=out.model+' · '+out.device;note='Resultado gerado neste navegador. Revise antes de utilizar.';
   }else{
    if(!onlineConsent)throw Error('Autorize o uso do modelo online antes da execução.');
    const j=await api('/api/superagente',{method:'POST',body:JSON.stringify({
     prompt:prepareBotRequest(activeBot,text,profile?.instructions),
     messages:historyForRequest(messages),externalAiConsent:true,allowEngineFallback:allowsExternalFallback(onlineConsent,fallbackConsent),
     preferredMotor:selectedModel
    })});
    reply=j.reply;source=j.isGenerativeModel?('IA · '+String(j.engine||j.model||'online')):
     'Regras locais (motor online não respondeu)';
    note=j.notice||'Confira o resultado antes de utilizar.';
   }
   if(typeof reply!=='string'||!reply.trim())throw Error('Nenhum texto foi gerado.');
   const savedBot=await db.from('openbot_messages').insert({
    owner_id:owner,thread_id:active.id,role:'assistant',content:reply.slice(0,18000),source:source.slice(0,140)
   }).select('id,role,content,source,created_at').single();
   if(savedBot.error||!savedBot.data){
    setMessages(old=>[...old,{id:'unsaved-'+Date.now(),role:'assistant',content:reply.slice(0,18000),source,created_at:new Date().toISOString()}]);
    throw Error('Resposta gerada, mas não foi salva no Supabase: '+(savedBot.error?.message||'erro desconhecido'));
   }
   setMessages(old=>[...old,savedBot.data]);setNotice(note);
   const updatedAt=new Date().toISOString();
   await db.from('openbot_threads').update({updated_at:updatedAt}).eq('id',active.id).eq('owner_id',owner);
   setThreads(old=>[...old].map(t=>t.id===active.id?{...t,updated_at:updatedAt}:t)
    .sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)));
  }catch(e){setError(safeError(e))}
  finally{sendLock.current=false;setBusy(false)}
 }

 const canSend=!!draft.trim()&&consentReady&&!busy&&!loadingChat;
 const currentThreadMessages=messages.length;
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const tab=params.get('integrations');
  const requestedBot=params.get('bot');
  if(!initialBot&&requestedBot&&OPENBOT_BOTS.some(bot=>bot.key===requestedBot)){setActiveBot(requestedBot);if(params.get('new')==='1'){setThread(null);setMessages([]);setDraft('');}}
  if(tab==='mcp'){setAppsDefaultTab('mcp');setAppsOpen(true)}
  else if(tab==='1')setAppsOpen(true);
 },[]);
 return <div className={styles.studio+' '+(embedded?styles.embedded:'')}>
  {appsOpen&&<OpenBotConnectedApps request={api} initialTab={appsDefaultTab} onClose={()=>setAppsOpen(false)}
   onUseData={text=>{
    setDraft(String(text||'').slice(0,3200));setAppsOpen(false);
    setNotice('Dados carregados no campo de mensagem. Revise antes de enviar ao modelo.');
    editorRef.current?.focus();
   }}/>} 
  {!embedded&&mobileBots&&<button aria-label="Fechar menu lateral" className={styles.scrim} onClick={()=>setMobileBots(false)}/>}
  {!embedded&&<aside className={styles.sidebar+' '+(mobileBots?styles.sidebarOpen:'')} aria-label="Bots e conversas">
   <div className={styles.brand}><div className={styles.brandIcon}><Bot size={22}/></div>
    <div><strong>OPENBOT</strong><small>W1 Capital · Killa AI</small></div></div>
   <button className={styles.newButton} type="button" onClick={()=>newConversation()}><Plus size={18}/> Nova conversa</button>
   <div className={styles.sectionHeading}><span>Seus bots</span><small>{OPENBOT_BOTS.length} perfis</small></div>
   <nav className={styles.botList} aria-label="Selecionar bot">
    {OPENBOT_BOTS.map(b=><button key={b.key} type="button"
      aria-current={activeBot===b.key?'page':undefined}
      className={styles.botItem+' '+(activeBot===b.key?styles.botActive:'')}
      onClick={()=>chooseBot(b.key)} title={b.description}>
      <span className={styles.avatar} style={{'--agent':b.color}}>{b.short}</span>
      <span className={styles.botCopy}><strong>{b.name}</strong><small>{b.role}</small></span>
      {activeBot===b.key&&<span className={styles.activeDot}/>}
     </button>)}
   </nav>
   <div className={styles.sectionHeading}><span>Histórico de conversas</span><Clock3 size={14}/></div>
   <label className={styles.search}><Search size={15}/><input type="search" aria-label="Pesquisar conversas"
    value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar conversa..."/></label>
   <div className={styles.threadList} role="list">
    {loading?<p className={styles.empty}>Carregando suas conversas…</p>:
     !visibleThreads.length?<p className={styles.empty}>Nenhuma conversa salva. Inicie uma com um dos bots acima.</p>:
     visibleThreads.map(t=><button key={t.id} type="button" className={styles.threadItem+' '+(thread?.id===t.id?styles.threadActive:'')}
      onClick={()=>openThread(t)}>
      <MessageSquare size={16}/><span><strong>{t.title}</strong><small>{openbotLabel(t.bot_key)} · {dateLabel(t.updated_at)}</small></span>
     </button>)}
   </div>
   <div className={styles.sidebarBottom}>
    <button className={styles.appsEntry} type="button" onClick={()=>setAppsOpen(true)}><Plug size={16}/> Aplicativos conectados</button>
    <Link href="/dashboard"><ArrowLeft size={16}/> Voltar ao INFINITUM</Link>
    <Link href="/agentes/operacao"><SlidersHorizontal size={16}/> Agentes operacionais</Link>
   </div>
  </aside>}

  <main className={styles.main} aria-label="Conversa com agente">
   <header className={styles.chatHeader}>
    <div className={styles.chatIdentity}>
     {embedded&&onBack?<button className={styles.backToTeam} type="button" onClick={onBack}><ArrowLeft size={16}/> Equipe</button>:!embedded?<button className={styles.mobileToggle} type="button" aria-label="Abrir bots" onClick={()=>setMobileBots(true)}><PanelLeftOpen size={19}/></button>:null}
     <span className={styles.avatar+' '+styles.headerAvatar} style={{'--agent':bot.color}}>{bot.short}</span>
     <div><strong>{bot.name}</strong><small>{bot.role} · Rascunhos sob revisão</small></div>
    </div>
    <div className={styles.headerActions}>
     <button title="Nova conversa" aria-label="Nova conversa" onClick={()=>newConversation()}><Plus size={17}/></button>
     <button title="Informações e ferramentas" aria-label="Abrir informações" aria-expanded={inspector}
      onClick={()=>setInspector(v=>!v)}>{inspector?<PanelRightClose size={19}/>:<PanelRightOpen size={19}/>}</button>
    </div>
   </header>

   <section className={styles.messageArea} aria-live="polite" aria-label="Mensagens da conversa">
    {loadingChat?<div className={styles.centerLoading}><LoaderCircle size={21} className={styles.spin}/> Abrindo histórico…</div>:
     !messages.length?<div className={styles.welcome}>
      <span className={styles.welcomeAvatar} style={{'--agent':bot.color}}>{bot.short}</span>
      <h1>Converse com {bot.name}</h1>
      <p>{bot.description}</p>
      <div className={styles.suggested}>
       {['Me ajude a organizar uma tarefa','Prepare um rascunho para revisão','Explique os próximos passos'].map(x=>
        <button key={x} type="button" onClick={()=>{setDraft(x);editorRef.current?.focus()}}>{x}</button>)}
      </div>
      <small>O OpenBot usa apenas os motores configurados. Sem envio automático, computador remoto ou fontes inventadas.</small>
     </div>:
     <div className={styles.messageStack}>{hasOlder&&<button className="inf-ai-history" type="button" disabled={olderLoading||busy} onClick={loadOlder}>{olderLoading?'Carregando…':'Carregar mensagens anteriores'}</button>}{messages.map(m=><article key={m.id} className={styles.message+' '+(m.role==='user'?styles.userMessage:styles.botMessage)}>
      {m.role==='assistant'&&<span className={styles.miniAvatar} style={{'--agent':bot.color}}>{bot.short}</span>}
      <div className={styles.bubble}>
       <div className={styles.messageContent}>{m.content}</div>
       <footer><span>{m.role==='user'?'Você':(m.source||bot.name)}</span><time>{timeLabel(m.created_at)}</time>
        {m.role==='assistant'&&<button type="button" aria-label="Copiar resposta" onClick={()=>
         navigator.clipboard?.writeText ? navigator.clipboard.writeText(m.content).then(()=>setNotice('Resposta copiada.')).catch(()=>setError('Não foi possível copiar.')) : setError('A cópia não está disponível neste navegador.')}><Copy size={14}/></button>}
       </footer>
      </div>
     </article>)}{busy&&<div className={styles.processing}><LoaderCircle size={17} className={styles.spin}/>
       {selectedModel==='qwen'?'Modelo local em execução…':'Preparando resposta…'}</div>}<div ref={bottomRef}/></div>}
   </section>

   <div className={styles.composerWrap}>
    {error&&<div role="alert" className={styles.error}><AlertTriangle size={15}/>{error}
      <button onClick={()=>setError('')} aria-label="Fechar aviso">×</button></div>}
    {notice&&<div role="status" className={styles.notice}><CheckCircle2 size={15}/>{notice}
      <button onClick={()=>setNotice('')} aria-label="Dispensar aviso">×</button></div>}
    <form className={styles.composer} onSubmit={send}>
     <textarea ref={editorRef} aria-label="Enviar mensagem ao bot" value={draft} maxLength={3200}
      rows={2} disabled={busy} onChange={e=>setDraft(e.target.value)}
      onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send()}}}
      placeholder={'Mensagem para '+bot.name+'… (Enter para enviar, Shift+Enter para quebrar linha)'}/>
     <div className={styles.composerFooter}>
      <div className={styles.modelPicker}><SlidersHorizontal size={15}/>
       <label htmlFor="openbot-model">Motor</label>
       <select id="openbot-model" value={selectedModel} disabled={busy} onChange={e=>changeModel(e.target.value)}>
        {models.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
       </select>
      </div>
      <div className={styles.sendActions}><span>{draft.length}/3200</span>
       <button type="submit" className={styles.sendButton} disabled={!canSend} aria-label="Gerar resposta"><Send size={18}/></button></div>
     </div>
    </form>
    {online&&<label className={styles.consent}><input type="checkbox" checked={onlineConsent}
      onChange={e=>setOnlineConsent(e.target.checked)}/> Autorizo enviar este texto e o contexto recente ao provedor de IA online.</label>}
    {online&&onlineConsent&&<label className={styles.consent}><input type="checkbox" checked={fallbackConsent} onChange={e=>setFallbackConsent(e.target.checked)}/> Permitir outros provedores se o motor escolhido falhar</label>}
    {local&&<label className={styles.consent}><input type="checkbox" checked={localConsent}
      onChange={e=>setLocalConsent(e.target.checked)}/> Autorizo baixar e executar o Qwen no meu navegador.</label>}
    <p className={styles.disclaimer}><ShieldCheck size={13}/> Respostas exigem revisão. O OpenBot não envia WhatsApp nem executa ações externas sozinho.</p>
   </div>
  </main>

  {inspector&&<aside className={styles.inspector} aria-label="Detalhes e ferramentas do bot">
   <div className={styles.inspectorHead}><strong>Seu agente</strong><button aria-label="Fechar painel" onClick={()=>setInspector(false)}><PanelRightClose size={17}/></button></div>
   <div className={styles.tabs} role="tablist">
    {[['sobre','Sobre',Bot],['atividade','Atividade',Activity],['ferramentas','Ferramentas',Plug]].map(([id,label,Icon])=>
     <button key={id} type="button" role="tab" aria-selected={panel===id} className={panel===id?styles.tabActive:''}
      onClick={()=>setPanel(id)}><Icon size={14}/>{label}</button>)}
   </div>
   <div className={styles.inspectBody}>
    {panel==='sobre'&&<>
     <div className={styles.botHero}><span className={styles.bigAvatar} style={{'--agent':bot.color}}>{bot.short}</span>
      <h2>{bot.name}</h2><p>{bot.description}</p></div>
     <h3>Capacidades disponíveis</h3>
     <div className={styles.tags}>{bot.skills.map(x=><span key={x}>{x}</span>)}</div>
     <div className={styles.inspectorStatus}><CheckCircle2 size={15}/> Rascunhos e conversas privadas por usuário</div>
     <button type="button" className={styles.outlineAction} onClick={()=>setSettingsOpen(x=>!x)}>
      <SlidersHorizontal size={16}/> {settingsOpen?'Fechar preferências':'Editar instruções do bot'}</button>
     {settingsOpen&&<div className={styles.settings}>
      <label>Memória de perfil e instruções adicionais<textarea rows={6} maxLength={1400} value={customInstruction}
       onChange={e=>setCustomInstruction(e.target.value)} placeholder="Como este agente deve responder?"/></label>
      <p>Preferências privadas deste perfil. O agente não transforma automaticamente mensagens lidas em fatos permanentes. As regras de segurança e revisão não podem ser desativadas.</p>
      <button type="button" onClick={saveProfile} disabled={savingSettings}>{savingSettings?'Salvando…':'Salvar instruções e motor'}</button>
     </div>}
     <h3>Configuração da conversa</h3>
     <p className={styles.muted}>Motor selecionado: {models.find(x=>x.id===selectedModel)?.label||'Indisponível'}</p>
     {thread&&<button type="button" className={styles.dangerAction} onClick={removeThread}>
      <Trash2 size={15}/>{pendingDelete?'Confirmar exclusão desta conversa':'Excluir conversa'}</button>}
     {pendingDelete&&<p className={styles.warning}>Exclusão definitiva do histórico desta conversa no Supabase. Nenhuma conversa do WhatsApp será alterada.</p>}
    </>}
    {panel==='atividade'&&<>
     <h3>Execuções do agente</h3>
     <p className={styles.muted}>Registros confirmados da fila operacional do INFINITUM. Conversas não são contadas como tarefas concluídas.</p>
     <div className={styles.statGrid}><div><strong>{currentThreadMessages}</strong><span>Mensagens</span></div><div><strong>{messages.filter(m=>m.role==='assistant').length}</strong><span>Respostas</span></div></div>
     {!activityRuns.length?<p className={styles.muted}>Nenhuma execução registrada para este perfil.</p>:activityRuns.slice(0,8).map(r=><div className={styles.activityRow} key={r.id}><Activity size={14}/><span><strong>{String(r.task||'Execução registrada').slice(0,110)}</strong><small>{String(r.status||'Registrado')} · {timeLabel(r.created_at)}</small></span></div>)}
     <h3>Mensagens desta conversa</h3>
     {!messages.length?<p className={styles.muted}>Nenhuma mensagem registrada.</p>:messages.slice(-10).reverse().map(m=>
      <div className={styles.activityRow} key={m.id}><Clock3 size={14}/>
       <span><strong>{m.role==='user'?'Pedido do operador':'Rascunho gerado'}</strong><small>{timeLabel(m.created_at)} · {m.source||bot.name}</small></span></div>)}
     <div className={styles.inspectorStatus}><ShieldCheck size={15}/> Todas as respostas são para revisão antes de uso.</div>
    </>}
    {panel==='ferramentas'&&<>
     <h3>Ferramentas e integrações</h3>
     <p className={styles.muted}>Conecte sistemas conscientemente. Não mostramos ferramentas inexistentes como se estivessem ativas.</p>
     <div className={styles.toolRow}><Monitor size={18}/><div><strong>Computador</strong><small>{OPENBOT_CAPABILITIES.browserControl?'Disponível':'Controle remoto não conectado'}</small></div></div>
     <div className={styles.toolRow}><Plug size={18}/><div><strong>Apps via MCP</strong><small>Configuração protegida por OAuth e MFA</small></div><Link href="/mcp/setup" title="Configurar MCP"><ExternalLink size={15}/></Link></div>
     <div className={styles.toolRow}><MessageSquare size={18}/><div><strong>ZapFast · WhatsApp</strong><small>Abre separadamente; não transfere a sessão nem envia mensagens</small></div>
      <a href={ZAPFAST_SINGLE_SESSION_URL} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/></a></div>
     <div className={styles.toolRow}><FileText size={18}/><div><strong>Operação jurídica</strong><small>Processos e atendimentos no CRM autorizado</small></div><Link href="/agentes/operacao"><ExternalLink size={15}/></Link></div>
     <div className={styles.toolRow}><Activity size={18}/><div><strong>Fila de tarefas</strong><small>Prioridades, retornos e pendências registradas no CRM</small></div><Link href="/tarefas"><ExternalLink size={15}/></Link></div>
     <div className={styles.toolRow}><ShieldCheck size={18}/><div><strong>Central de aprovações</strong><small>Revisão humana de propostas de alteração e permissões</small></div><Link href="/mcp/approve"><ExternalLink size={15}/></Link></div>
     <h3>Aprovações</h3>
     <div className={styles.inspectorStatus}><ShieldCheck size={15}/> {OPENBOT_APPROVAL==='manual_review_only'?'Revisão humana obrigatória':'Verificar configuração'}</div>
     <p className={styles.muted}>Execução em segundo plano e controle de computadores não estão habilitados nesta versão. Não são simulados.</p>
    </>}
   </div>
   <div className={styles.inspectorFoot}><button type="button" className={styles.appsEntry} onClick={()=>setAppsOpen(true)}><Plug size={15}/> Conectar aplicativos</button>
    <Link href="/dashboard"><ArrowLeft size={15}/> CRM</Link></div>
  </aside>}
 </div>;
}
