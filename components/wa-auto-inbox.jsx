'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {draftForChat,updateChatDraft,acceptedSendState} from '../lib/infinitum-agent-policy.mjs';
import {archiveChats,archiveMessages,mergeChats,mergeMessages,messageState} from '../lib/wa-auto-archive.mjs';
import {ZAPFAST_SINGLE_SESSION_URL} from '../lib/openbot-workspace-policy.mjs';
import OfficeLegalAgentPanel from './office-legal-agent-panel';
import WhatsappTabBridgePanel from './whatsapp-tab-bridge-panel';
import {ArrowLeft,CheckCircle2,ChevronDown,ExternalLink,Link2Off,LoaderCircle,MessageCircle,MessageSquare,Plus,RefreshCw,Search,Send,Settings2,ShieldCheck,Smartphone,Users,Wifi,WifiOff,X} from 'lucide-react';
const stamp=value=>{if(!value)return '';const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'})};
const tiny=value=>String(value||'').trim().slice(0,220);
const userName=c=>tiny(c?.name)||tiny(c?.phone)||tiny(c?.jid?.split('@')[0])||'Conversa';
const clock=value=>value?stamp(value).split(' ').pop():'';
export default function WaAutoInbox({db,userId}){
 const [status,setStatus]=useState(null),[chats,setChats]=useState([]),[messages,setMessages]=useState([]);
 const [selected,setSelected]=useState(null),[query,setQuery]=useState(''),[groups,setGroups]=useState(false);
 const [archiveOffset,setArchiveOffset]=useState(150),[moreArchive,setMoreArchive]=useState(true),[olderBusy,setOlderBusy]=useState(false);
 const [chatOffset,setChatOffset]=useState(180),[moreChats,setMoreChats]=useState(true),[chatBusy,setChatBusy]=useState(false);
 const activeJid=useRef(null);
 activeJid.current=selected?.jid||null;
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [drafts,setDrafts]=useState({}),[pairPhone,setPairPhone]=useState(''),[newPhone,setNewPhone]=useState('');
 const draft=draftForChat(drafts,selected?.jid);
 const setDraft=value=>setDrafts(old=>updateChatDraft(old,selected?.jid,value));
 const [showConnect,setShowConnect]=useState(false),[showNew,setShowNew]=useState(false),[qrImage,setQrImage]=useState('');
 const [lastSync,setLastSync]=useState(''),[archiveWarning,setArchiveWarning]=useState(''),[archiveAt,setArchiveAt]=useState('');
 const [syncUnsupported,setSyncUnsupported]=useState(false);
 const [desktopZapFast,setDesktopZapFast]=useState(false);
 useEffect(()=>setDesktopZapFast(typeof window.killaDesktop?.openZapFast==='function'),[]);
 const statusPollingEnabled=useRef(true);
 const connected=status?.configured&&status?.connected;
 const connection=status?.connection||{};
 const api=useCallback(async(action,payload=null)=>{
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw new Error('Sessão expirada. Entre novamente no CRM.');
  const post=payload!==null;
  const q=new URLSearchParams({action,...(!post?Object.fromEntries(Object.entries(payload||{}).map(([k,v])=>[k,String(v??'')])):{})});
  const response=await fetch('/api/office/whatsapp/bridge'+(post?'':'?'+q),{
    method:post?'POST':'GET',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
    ...(post?{body:JSON.stringify({action,...payload})}:{}),cache:'no-store'
  });
  let body;try{body=await response.json()}catch{throw new Error('O servidor de WhatsApp retornou resposta inválida.')}
  if(!response.ok||!body?.ok)throw new Error(body?.error||'O WA.Auto não respondeu.');
  return body;
 },[db]);
 const reloadStatus=useCallback(async()=>{
  try{
   const body=await api('status');
   // Pause polling when the upstream integration is unavailable; manual refresh remains possible.
   statusPollingEnabled.current=body.configured===true;
   setStatus(body);setLastSync(new Date().toISOString());
   return body;
  }catch(error){
   statusPollingEnabled.current=false;
   throw error;
  }
 },[api]);
 const loadArchiveChats=useCallback(async()=>{
  if(!userId)return [];
  const {data,error:err}=await db.from('office_wa_chat_archive')
    .select('jid,name,phone,is_group,last_message,last_message_at')
    .eq('owner_id',userId).order('last_message_at',{ascending:false}).order('jid',{ascending:true}).limit(180);
  if(err){setArchiveWarning('Arquivo de conversas indisponível: '+err.message);return []}
  setChats(old=>mergeChats(old,data||[],5000));if((data||[]).length<180)setMoreChats(false);return data||[];
 },[db,userId]);
 const loadArchiveMessages=useCallback(async jid=>{
  if(!userId||!jid)return [];
  const {data,error:err}=await db.from('office_wa_message_archive')
   .select('provider_message_id,content,is_from_me,media_type,timestamp,ack,jid')
   .eq('owner_id',userId).eq('jid',jid).order('timestamp',{ascending:false}).order('provider_message_id',{ascending:true}).limit(150);
  if(err){setArchiveWarning('Não foi possível ler as mensagens salvas: '+err.message);return []}
  const rows=(data||[]).map(item=>({...item,id:item.provider_message_id}));
  if(activeJid.current===jid){setMessages(old=>mergeMessages(old,rows,5000));if(rows.length<150)setMoreArchive(false)}return rows;
 },[db,userId]);
 async function readOlder(){
  const jid=activeJid.current;if(!jid||olderBusy||!moreArchive)return;
  setOlderBusy(true);
  try{const {data,error}=await db.from('office_wa_message_archive').select('provider_message_id,content,is_from_me,media_type,timestamp,ack,jid').eq('owner_id',userId).eq('jid',jid).order('timestamp',{ascending:false}).order('provider_message_id',{ascending:true}).range(archiveOffset,archiveOffset+149);
   if(error)throw error;
   if(activeJid.current!==jid)return;
   const rows=(data||[]).map(item=>({...item,id:item.provider_message_id}));
   setMessages(old=>mergeMessages(old,rows,5000));setArchiveOffset(n=>n+rows.length);setMoreArchive(rows.length===150&&archiveOffset+rows.length<5000);
  }catch(e){if(activeJid.current===jid)setArchiveWarning('Histórico anterior indisponível: '+e.message)}finally{setOlderBusy(false)}
 }
 async function readMoreChats(){
  if(chatBusy||!moreChats)return;setChatBusy(true);
  try{const {data,error}=await db.from('office_wa_chat_archive').select('jid,name,phone,is_group,last_message,last_message_at').eq('owner_id',userId).order('last_message_at',{ascending:false}).order('jid',{ascending:true}).range(chatOffset,chatOffset+179);
   if(error)throw error;const rows=data||[];setChats(old=>mergeChats(old,rows,5000));setChatOffset(n=>n+rows.length);setMoreChats(rows.length===180&&chatOffset+rows.length<5000);
  }catch(e){setArchiveWarning('Outras conversas indisponíveis: '+e.message)}finally{setChatBusy(false)}
 }
 const persistArchive=useCallback(async(rawChats=[],rawMessages=[])=>{
  if(!userId)return;
  const chatsToSave=archiveChats(rawChats,userId),messagesToSave=archiveMessages(rawMessages,userId);
  // Insert missing chat parents without overwriting contact names during message-only sync.
  const parents=archiveChats(messagesToSave.map(m=>({jid:m.jid})),userId);
  if(parents.length){
   const {error:err}=await db.from('office_wa_chat_archive').upsert(parents,{onConflict:'owner_id,jid',ignoreDuplicates:true});
   if(err)throw Error('Não foi possível preparar histórico: '+err.message);
  }
  if(chatsToSave.length){
   const {error:err}=await db.from('office_wa_chat_archive').upsert(chatsToSave,{onConflict:'owner_id,jid'});
   if(err)throw Error('Não foi possível arquivar conversas: '+err.message);
  }
  if(messagesToSave.length){
   const {error:err}=await db.from('office_wa_message_archive').upsert(messagesToSave,{onConflict:'owner_id,jid,provider_message_id'});
   if(err)throw Error('Não foi possível arquivar mensagens: '+err.message);
  }
  if(chatsToSave.length||messagesToSave.length)setArchiveAt(new Date().toISOString());
 },[db,userId]);
 const reloadChats=useCallback(async(search='',onlyGroups=false)=>{
  const p=await api('chats',{q:search,onlyGroups:onlyGroups?'1':'0',limit:100});
  const rows=Array.isArray(p.chats)?p.chats:[];
  setChats(old=>mergeChats(old,rows,5000));
  await persistArchive(rows,[]).catch(e=>setArchiveWarning(e.message));
  return p;
 },[api,persistArchive]);
 const reloadMessages=useCallback(async jid=>{
  if(!jid)return;
  const p=await api('messages',{jid,limit:100});
  const rows=Array.isArray(p.messages)?p.messages:[];
  if(activeJid.current===jid)setMessages(old=>mergeMessages(old,rows.map(x=>({...x,chat_jid:x.chat_jid||jid})).reverse(),5000));
  await persistArchive([],rows.map(x=>({...x,chat_jid:x.chat_jid||jid}))).catch(e=>setArchiveWarning(e.message));
 },[api,persistArchive]);
 const syncRecent=useCallback(async()=>{
  if(syncUnsupported)return;
  try{
   const p=await api('sync');
   const currentChats=Array.isArray(p.chats)?p.chats:[];
   const recentMessages=Array.isArray(p.messages)?p.messages:[];
   await persistArchive(currentChats,recentMessages);
   setChats(old=>mergeChats(old,currentChats,5000));
   if(activeJid.current===selected?.jid)setMessages(old=>mergeMessages(old,recentMessages.filter(x=>x.chat_jid===selected?.jid),5000));
  }catch(e){if(/404|não permitida|not found|Operação não encontrada/i.test(e.message))setSyncUnsupported(true);else setArchiveWarning('Atualização recente indisponível: '+e.message)}
 },[api,persistArchive,selected?.jid,syncUnsupported]);
 useEffect(()=>{
  let alive=true;
  loadArchiveChats().catch(e=>{if(alive)setArchiveWarning(e.message)});
  reloadStatus().then(s=>{if(alive&&s.connected){reloadChats().catch(e=>{if(alive)setError(e.message)});}})
   .catch(e=>{if(alive)setError(e.message)});
  const id=window.setInterval(()=>{
   if(document.visibilityState==='visible'&&statusPollingEnabled.current)
    reloadStatus().catch(e=>{if(alive){setStatus(old=>old?{...old,connected:false}:old);setError(e.message)}});
  },15000);
  return()=>{alive=false;window.clearInterval(id)};
 },[reloadStatus,reloadChats,loadArchiveChats]);
 useEffect(()=>{
  if(!connected)return;
  const id=window.setTimeout(()=>reloadChats(query,groups).catch(e=>setError(e.message)),350);
  return()=>window.clearTimeout(id);
 },[query,groups,connected,reloadChats]);
 useEffect(()=>{
  if(!selected?.jid){setMessages([]);return}
  let live=true;setMessages([]);setArchiveOffset(150);setMoreArchive(true);
  loadArchiveMessages(selected.jid).catch(e=>{if(live)setArchiveWarning(e.message)});
  if(connected)reloadMessages(selected.jid).catch(e=>{if(live)setError(e.message)});
  return()=>{live=false};
 },[selected?.jid,connected,reloadMessages,loadArchiveMessages]);
 useEffect(()=>{
  const id=window.setInterval(()=>{
   if(document.visibilityState!=='visible')return;
   loadArchiveChats().catch(()=>{});
   if(selected?.jid)loadArchiveMessages(selected.jid).catch(()=>{});
   if(connected){reloadChats(query,groups).catch(()=>{});if(selected?.jid)reloadMessages(selected.jid).catch(()=>{});}
  },25000);
  return()=>window.clearInterval(id);
 },[loadArchiveChats,loadArchiveMessages,reloadChats,reloadMessages,selected?.jid,connected,query,groups]);
 useEffect(()=>{
  let timer=null;
  const onRealtime=event=>{
   const table=event?.detail?.table;
   if(table!=='office_wa_chat_archive'&&table!=='office_wa_message_archive')return;
   if(document.visibilityState!=='visible')return;
   if(timer!==null)window.clearTimeout(timer);
   timer=window.setTimeout(()=>{
    timer=null;
    loadArchiveChats().catch(()=>{});
    if(selected?.jid)loadArchiveMessages(selected.jid).catch(()=>{});
   },650);
  };
  window.addEventListener('killa:realtime',onRealtime);
  return()=>{window.removeEventListener('killa:realtime',onRealtime);if(timer!==null)window.clearTimeout(timer)};
 },[loadArchiveChats,loadArchiveMessages,selected?.jid]);
 useEffect(()=>{
  if(!connected||syncUnsupported)return;
  syncRecent();const id=window.setInterval(()=>{if(document.visibilityState==='visible')syncRecent()},45000);
  return()=>window.clearInterval(id);
 },[connected,syncRecent,syncUnsupported]);
 useEffect(()=>{
  let active=true;
  if(!connection.qr){setQrImage('');return}
  if(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(String(connection.qr))){setQrImage(String(connection.qr));return}
  import('qrcode').then(q=>q.default.toDataURL(String(connection.qr),{width:235,margin:1,errorCorrectionLevel:'M'})).then(url=>{if(active)setQrImage(url)}).catch(()=>{if(active)setQrImage('')});
  return()=>{active=false};
 },[connection.qr]);
 async function action(name,payload={}){
  if(busy)return;
  setBusy(name);setError('');setNotice('');
  const targetJid=selected?.jid;let accepted=false;
  try{
   const r=await api(name,payload);
   if(r.connection)setStatus(old=>({...old,configured:true,connected:r.connection.status==='ready',connection:r.connection}));
   if(name==='send'){
    accepted=true;setDrafts(old=>updateChatDraft(old,targetJid,''));setNotice(acceptedSendState(true,false).notice);
    const jid=targetJid;
    if(jid&&r.messageId){
     const echo={id:String(r.messageId),chat_jid:jid,content:String(payload.message||''),is_from_me:true,
       media_type:null,timestamp:new Date().toISOString(),ack:0};
     if(activeJid.current===jid)setMessages(old=>mergeMessages(old,[echo],5000));
     await persistArchive([current||{jid,name:jid.split('@')[0]}],[echo]).catch(e=>setArchiveWarning(e.message));
    }
    if(jid)await reloadMessages(jid).catch(e=>setArchiveWarning('Envio aceito; atualização de histórico indisponível: '+e.message));
    await reloadChats(query,groups).catch(()=>{});
   }
   else if(name==='logout'){setChats([]);setMessages([]);setSelected(null);setDrafts({});setNotice('Aparelho desvinculado desta sessão.')}
   else setNotice(name==='connect'?'Solicitação de conexão enviada. Leia o QR quando aparecer.':'Pareamento iniciado. Confira o código no aparelho.');
   await reloadStatus().catch(e=>{setStatus(old=>old?{...old,connected:false}:old);if(accepted)setNotice(acceptedSendState(true,true).notice);else setArchiveWarning('Status não atualizado: '+e.message)});
  }catch(e){if(accepted)setNotice(acceptedSendState(true,true).notice);else if(name==='send')setError(acceptedSendState(false,false).notice+' '+e.message);else setError(e.message)}finally{setBusy('')}
 }
 function startChat(e){
  e.preventDefault();setError('');
  let phone=String(newPhone||'').replace(/\D/g,'');
  if(/^\d{10,11}$/.test(phone))phone='55'+phone;
  if(!/^55\d{10,11}$/.test(phone)){setError('Informe um telefone brasileiro com DDD.');return}
  setSelected({jid:phone+'@s.whatsapp.net',phone,name:phone});
  setNewPhone('');setShowNew(false);setMessages([]);
 }
 async function refresh(){
  if(busy)return;setBusy('refresh');setError('');
  try{await loadArchiveChats();if(selected?.jid)await loadArchiveMessages(selected.jid);const s=await reloadStatus();if(s.connected){await reloadChats(query,groups);if(selected?.jid)await reloadMessages(selected.jid);await syncRecent()}}
  catch(e){setError(e.message)}finally{setBusy('')}
 }
 const current=useMemo(()=>chats.find(c=>c.jid===selected?.jid)||selected,[chats,selected]);
 const currentMessages=useMemo(()=>messages.filter(m=>(m.chat_jid||m.jid)===current?.jid),[messages,current?.jid]);
 const visibleChats=useMemo(()=>chats.filter(c=>(!groups||c.is_group)&&
  [c.name,c.phone,c.jid].some(x=>String(x||'').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))),[chats,groups,query]);
 return <main className="wa-workspace">
  <header className="wa-heading"><div><small>PROJECTW1SC / COMUNICAÇÃO</small><h1>WhatsApp <span>Workspace</span></h1><p>Use a sessão WA.Auto ou conecte à aba WhatsApp Web já aberta no seu computador, sem novo QR Code. Cada forma de acesso é independente.</p></div>
   <div className="wa-heading-actions">
    {desktopZapFast?<button className="wa-button ghost" type="button" onClick={()=>window.killaDesktop?.openZapFast().catch(()=>setError("Não foi possível abrir a janela ZapFast."))} title="Abrir ZapFast em janela própria no desktop, sem novo QR Code"><ExternalLink size={15}/> ZapFast · abrir no desktop</button>:<a className="wa-button ghost" href={ZAPFAST_SINGLE_SESSION_URL} target="_blank" rel="noopener noreferrer" title="Abrir sessão já vinculada no ZapFast, sem gerar outro QR Code"><ExternalLink size={15}/> ZapFast · sessão existente</a>}
    <span className={'wa-state '+(connected?'online':'offline')}><span className="wa-dot"/>{connected?'WhatsApp conectado':!status?'Status não verificado':status?.code==='wa_auto_upstream_route_missing'?'WA.Auto sem rota':status?.configured?'Desconectado':'Aguardando configuração'}</span>
    <button className="wa-icon-btn" aria-label="Atualizar WhatsApp" type="button" disabled={!!busy} onClick={refresh}><RefreshCw size={17}/></button>
    <button className="wa-button" type="button" onClick={()=>setShowConnect(v=>!v)}><Smartphone size={16}/> Conexão</button>
   </div>
  </header>
  {error&&<div className="wa-alert error" role="alert">{error}<button type="button" aria-label="Fechar erro" onClick={()=>setError('')}><X size={15}/></button></div>}
  {archiveWarning&&<div className="wa-alert" role="status">{archiveWarning}<button type="button" aria-label="Fechar aviso de histórico" onClick={()=>setArchiveWarning('')}><X size={15}/></button></div>}
  {notice&&<div className="wa-alert" role="status"><CheckCircle2 size={17}/>{notice}</div>}
  <WhatsappTabBridgePanel/>
  {(!status?.configured||showConnect||!connected)&&<section className="wa-connection">
    <div className="wa-connection-title"><div className="wa-device-icon">{connected?<Wifi size={21}/>:<WifiOff size={21}/>}</div><div><strong>Seu WhatsApp · Conexão individual</strong><p>{status?.configured?tiny(connection.message)||'Sessão vinculada à sua conta do CRM.':tiny(status?.message)||'Serviço WA.Auto indisponível no servidor. Não informe credenciais nesta página.'}</p></div></div>
    {!status?.configured?<div className="wa-help">{status?.code==='wa_auto_upstream_route_missing'?
     <>A integração WA.Auto não oferece a rota esperada (HTTP 404). A consulta automática foi pausada. Você pode tentar novamente pelo botão atualizar ou abrir <a href={ZAPFAST_SINGLE_SESSION_URL} target="_blank" rel="noopener noreferrer">sua sessão ZapFast</a>, sem criar outro QR Code.</>:
     'O servidor WhatsApp precisa estar disponível para gerar o QR. A identidade e as credenciais são verificadas no servidor; nunca cole tokens nesta página.'}</div>:<div className="wa-connect-content">
     {connected&&connection.account?.phone&&<p className="wa-linked-number">Número vinculado somente à sua conta: <strong>+{String(connection.account.phone).replace(/\D/g,'')}</strong></p>}
     {qrImage&&connection.status!=='ready'&&<div className="wa-qr"><img src={qrImage} alt="QR Code para vincular WhatsApp" width={235} height={235}/><small>Abra o WhatsApp no celular → Aparelhos conectados → Conectar aparelho. QR vincula somente sua sessão.</small></div>}
     {connection.pairingCode&&<div className="wa-pair-code">Código de pareamento: <strong>{connection.pairingCode}</strong></div>}
     <div className="wa-connect-actions">
      {!connected&&<button type="button" className="wa-button" disabled={!!busy} onClick={()=>action('connect')}><Smartphone size={16}/> {busy==='connect'?'Conectando...':'Conectar por QR'}</button>}
      {!connected&&<form onSubmit={e=>{e.preventDefault();action('pair',{phone:pairPhone})}} className="wa-pair-form"><input aria-label="Telefone para pareamento" value={pairPhone} onChange={e=>setPairPhone(e.target.value)} placeholder="DDD + telefone" type="tel"/><button className="wa-button ghost" disabled={!!busy||!pairPhone.trim()}>Gerar código</button></form>}
      {connected&&<button type="button" className="wa-button danger" disabled={!!busy} onClick={()=>{if(window.confirm('Desvincular o aparelho desta sessão WhatsApp?'))action('logout')}}><Link2Off size={16}/> Desvincular</button>}
     </div>
     </div>}
     <div className="wa-disclaimer"><ShieldCheck size={15}/> WA.Auto e ZapFast usam conexões próprias: não pareie o mesmo número novamente só para abrir outra interface. A ponte local acima usa a aba WhatsApp Web já conectada, sem registrar outro dispositivo e sem enviar mensagens automaticamente.</div>
  </section>}
  <section className="wa-chat-layout" aria-label="Central de conversas">
   <aside className={'wa-contacts '+(current?'wa-mobile-hidden':'')}>
    <div className="wa-pane-header"><div><small>CAIXA DE ENTRADA</small><h2>Conversas <span>{visibleChats.length}</span></h2></div><button className="wa-icon-btn" type="button" onClick={()=>setShowNew(v=>!v)} title="Nova conversa" aria-label="Nova conversa"><Plus size={20}/></button></div>
    {showNew&&<form className="wa-new-chat" onSubmit={startChat}><label>Iniciar conversa por telefone</label><input type="tel" autoFocus value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="(11) 99999-9999" required/><button className="wa-button" type="submit">Abrir contato</button></form>}
    <label className="wa-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar contato ou telefone..." aria-label="Pesquisar conversas"/></label>
    <div className="wa-filters"><button aria-pressed={!groups} onClick={()=>setGroups(false)} type="button" className={!groups?'selected':''}>Todas</button><button aria-pressed={groups} onClick={()=>setGroups(true)} type="button" className={groups?'selected':''}><Users size={14}/> Grupos</button></div>
    <div className="wa-contact-list">{visibleChats.length?visibleChats.map(c=><button type="button" key={c.jid} className={'wa-contact '+(current?.jid===c.jid?'selected':'')} disabled={busy==='send'} onClick={()=>setSelected(c)}><span className="wa-avatar">{userName(c).charAt(0).toUpperCase()}</span><span className="wa-contact-copy"><span className="wa-contact-title"><strong>{userName(c)}</strong><small>{clock(c.last_message_at)}</small></span><span className="wa-contact-message">{tiny(c.last_message)||c.phone||'Conversa disponível'}</span></span></button>):<div className="wa-empty"><Search size={22}/><strong>Nenhuma conversa encontrada</strong><p>Conversas anteriores continuam disponíveis quando salvas. Vincule o WhatsApp para receber novas mensagens.</p></div>}</div>
    {moreChats&&<button className="wa-button ghost inf-history-more" type="button" disabled={chatBusy} onClick={readMoreChats}>{chatBusy?'Carregando…':'Mais conversas arquivadas'}</button>}<div className="wa-contact-footer">WA.Auto · histórico no CRM {archiveAt?'· salvo '+clock(archiveAt):''} {connected&&lastSync?'· conexão '+clock(lastSync):''}</div>
   </aside>
   <section className={'wa-conversation '+(!current?'wa-mobile-hidden':'')}>
    {current?<><div className="wa-conversation-header"><button type="button" className="wa-icon-btn wa-back" disabled={busy==='send'} onClick={()=>setSelected(null)} aria-label="Voltar à lista"><ArrowLeft size={20}/></button><span className="wa-avatar">{userName(current).charAt(0).toUpperCase()}</span><div className="wa-conversation-heading"><strong>{userName(current)}</strong><small>{current.phone||current.jid} · {connected?'Conectado':'Histórico salvo · serviço offline'}</small></div><button type="button" className="wa-icon-btn" aria-label="Atualizar mensagens" onClick={()=>reloadMessages(current.jid).catch(e=>setError(e.message))}><RefreshCw size={16}/></button></div>
      <div className="wa-message-list" aria-live="polite">{moreArchive&&<button className="wa-button ghost inf-history-more" type="button" disabled={olderBusy} onClick={readOlder}>{olderBusy?'Carregando…':'Mensagens anteriores'}</button>}{currentMessages.length?currentMessages.map((m,i)=><div className={'wa-message '+(m.is_from_me?'outgoing':'incoming')} key={m.id||i}><div>{String(m.content||'').slice(0,4000)|| (m.media_type?'[Mídia: '+m.media_type+']':'[Mensagem sem texto]')}</div><small>{stamp(m.timestamp)}{m.is_from_me?' · '+messageState(m):''}</small></div>):<div className="wa-empty"><MessageCircle size={28}/><strong>Nenhuma mensagem nesta conversa</strong><p>Não há mensagens arquivadas para esta conversa. O histórico recebido por outros aparelhos depende do sincronismo do WhatsApp.</p></div>}</div>
      <OfficeLegalAgentPanel key={current.jid} db={db} selected={current} connected={connected} messages={currentMessages}
        onSent={()=>{reloadMessages(current.jid).catch(()=>{});reloadChats(query,groups).catch(()=>{});}}/>
      <form className="wa-composer" onSubmit={e=>{e.preventDefault();if(!draft.trim()||!connected)return;action('send',{to:current.is_group?current.jid:(current.phone||current.jid.split('@')[0]),message:draft.trim(),approved:true})}}><textarea aria-label="Mensagem WhatsApp" value={draft} maxLength={3000} rows={2} placeholder={connected?'Escreva sua mensagem...':'Histórico em leitura; conecte para enviar'} disabled={!connected||!!busy} onChange={e=>setDraft(e.target.value)}/><div className="wa-compose-footer"><small>Destinatário: {userName(current)} · rascunho desta conversa · {draft.length}/3000</small><button className="wa-button" type="submit" disabled={!connected||!draft.trim()||!!busy}><Send size={16}/> {busy==='send'?'Enviando...':'Enviar'}</button></div></form>
     </>:<div className="wa-no-chat"><div className="wa-no-chat-art"><MessageSquare size={52}/></div><h2>Um espaço para cada conversa</h2><p>Escolha um contato ao lado, consulte o histórico e responda sem sair do CRM.</p><div><ShieldCheck size={16}/> Conversas do WA.Auto, sem integração oficial da Meta</div></div>}
   </section>
  </section>
 </main>
}
