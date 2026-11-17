'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Puzzle,Plug,HardDrive,Table2,Mail,Instagram,MessageCircle,Building2,Github,
 CalendarDays,AtSign,Video,MessageSquare,Youtube,RefreshCw,ShieldCheck,ChevronRight,Link2,Check,AlertCircle,
 Loader2,Copy,X,Search,ExternalLink,LockKeyhole,ArrowLeft,KeyRound} from 'lucide-react';
import {ZAPFAST_SINGLE_SESSION_URL} from '../lib/openbot-workspace-policy.mjs';
import css from './openbot-connected-apps.module.css';

const ICONS={drive:HardDrive,sheets:Table2,gmail:Mail,instagram:Instagram,instagram_meta:Instagram,whatsapp:MessageCircle,zapfast:MessageCircle,
 crm:Building2,github:Github,outlook:AtSign,calendar:CalendarDays,meet:Video,chat:MessageSquare,youtube:Youtube,slack:Plug};
const GROUPS=['Google Workspace','Mensagens','Redes sociais','Trabalho','Desenvolvimento','Equipe'];
const safe=(error)=>String(error?.message||error||'Conexão indisponível').slice(0,240);
const age=v=>v?new Date(v).toLocaleDateString('pt-BR'):'não verificado';
const SERVICE_LABELS={drive:'Google Drive',sheets:'Google Sheets',gmail:'Gmail',calendar:'Google Calendar',meet:'Google Meet',chat:'Google Chat',chat_messages:'Mensagens do Google Chat',youtube:'YouTube',instagram:'Instagram'};

export default function OpenBotConnectedApps({request,onClose,onUseData,initialTab='apps'}){
 const [tab,setTab]=useState(initialTab),[catalog,setCatalog]=useState([]),[accounts,setAccounts]=useState([]),[composioAccounts,setComposioAccounts]=useState([]);
 const [mcp,setMcp]=useState(null),[loading,setLoading]=useState(true),[working,setWorking]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[selected,setSelected]=useState('');
 const [preview,setPreview]=useState(null),[crmQuery,setCrmQuery]=useState(''),[crmResult,setCrmResult]=useState(null);
 const [mcpClient,setMcpClient]=useState(''),[confirmRemove,setConfirmRemove]=useState('');
 const [editScope,setEditScope]=useState('read'),[editRequests,setEditRequests]=useState([]);
 const [confirmEditId,setConfirmEditId]=useState('');
 const connector=useMemo(()=>catalog.find(c=>c.id===selected),[catalog,selected]);
 const connectorAccounts=useMemo(()=>connector?.mode==='composio'?composioAccounts.filter(a=>a.toolkit===connector.composioToolkit):accounts.filter(a=>a.provider===connector?.provider),[accounts,composioAccounts,connector?.provider,connector?.mode,connector?.composioToolkit]);
 const groupItems=group=>catalog.filter(c=>c.category===group);
 const refresh=useCallback(async()=>{
  try{
   setError('');
   const [apps,mcpInfo,pending,composio]=await Promise.allSettled([
    request('/api/openbot/integrations'),request('/api/openbot/mcp/settings'),
    request('/api/openbot/mcp/edits'),request('/api/openbot/composio')
   ]);
   if(apps.status==='fulfilled'){setCatalog(apps.value.connectors||[]);setAccounts(apps.value.accounts||[])}
   else setError('Não foi possível ler as conexões: '+safe(apps.reason));
   if(composio.status==='fulfilled')setComposioAccounts(composio.value.apps||[]);
   else setComposioAccounts([]);
   if(pending.status==='fulfilled')setEditRequests(pending.value.proposals||[]);
   if(mcpInfo.status==='fulfilled')setMcp(mcpInfo.value);
   else setNotice('MCP indisponível nesta sessão: '+safe(mcpInfo.reason));
  }finally{setLoading(false)}
 },[request]);
 useEffect(()=>{refresh()},[refresh]);
 useEffect(()=>{
  const load=()=>{if(document.visibilityState==='visible')refresh()};
  window.addEventListener('focus',load);
  return()=>window.removeEventListener('focus',load);
 },[refresh]);

 function moveTo(id){setSelected(id);setPreview(null);setConfirmRemove('');setError('');setNotice('')}
 function openExternal(url){
  const parsed=new URL(url);
  if(parsed.protocol!=='https:')throw Error('Endereço externo inseguro.');
  const win=window.open(url,'_blank','noopener,noreferrer');
  if(!win&&typeof window.killaDesktop==='undefined')setNotice('Permita abrir uma nova aba para concluir a conexão.');
 }
 async function begin(connector){
  const provider=connector?.provider,connectorId=connector?.id;
  if(!['google','meta'].includes(provider)||working)return;
  setWorking(connectorId||provider);setError('');setNotice('');
  try{
   const result=await request('/api/openbot/integrations/oauth/start',{method:'POST',
    body:JSON.stringify({provider,connectorId})});
   if(!result.authorizationUrl)throw Error('O provedor não devolveu a página de autorização.');
   openExternal(result.authorizationUrl);
   setNotice('Autorize a conta na janela aberta e clique em Atualizar após voltar ao OpenBot.');
  }catch(e){setError(safe(e))}
  finally{setWorking('')}
 }
 async function beginComposio(connector){
  if(!connector?.composioToolkit||working)return;
  setWorking(connector.id);setError('');setNotice('');
  try{
   const result=await request('/api/openbot/composio',{method:'POST',
    body:JSON.stringify({toolkit:connector.composioToolkit})});
   if(!result.redirectUrl)throw Error('Composio não devolveu o link de autorização.');
   openExternal(result.redirectUrl);
   setNotice('Conclua a autorização na página do Composio. Depois volte e clique em Atualizar.');
  }catch(e){setError(safe(e))}
  finally{setWorking('')}
 }
 async function disconnectComposio(account){
  const id=account?.connectedAccountId;
  if(!id||working)return;
  if(confirmRemove!==id){setConfirmRemove(id);return}
  setWorking(id);setError('');setNotice('');
  try{
   const result=await request('/api/openbot/composio',{method:'DELETE',
    body:JSON.stringify({connectedAccountId:id})});
   setComposioAccounts(old=>old.filter(x=>x.connectedAccountId!==id));
   setConfirmRemove('');setNotice(result.notice||'Conta Composio desconectada.');
  }catch(e){setError(safe(e))}
  finally{setWorking('')}
 }
 async function disconnect(account){
  if(working)return;
  if(confirmRemove!==account.id){setConfirmRemove(account.id);return}
  setWorking(account.id);setError('');setNotice('');
  try{
   const result=await request('/api/openbot/integrations',{method:'DELETE',body:JSON.stringify({id:account.id})});
   setNotice(result.notice||'Conta removida do OpenBot.');
   setAccounts(old=>old.filter(x=>x.id!==account.id));setPreview(null);setConfirmRemove('');
  }catch(e){setError(safe(e))}
  finally{setWorking('')}
 }
 async function previewChatMessages(spaceName){
  const connectionId=preview?.connection?.id;
  if(!connectionId||working)return;
  setWorking(connectionId);setError('');
  try{
   const result=await request('/api/openbot/integrations/data?service=chat_messages&space_id='+encodeURIComponent(spaceName)+'&connection_id='+encodeURIComponent(connectionId));
   setPreview(result);
  }catch(e){setError('Não foi possível ler as mensagens deste espaço: '+safe(e))}
  finally{setWorking('')}
 }
 async function previewData(account){
  if(working||!connector)return;
  setWorking(account.id);setError('');setPreview(null);
  try{
   const service=connector.id==='instagram_meta'?'instagram':connector.id;
   const result=await request('/api/openbot/integrations/data?service='+encodeURIComponent(service)
    +'&connection_id='+encodeURIComponent(account.id));
   setPreview(result);
   setAccounts(old=>old.map(x=>x.id===account.id?{...x,last_checked_at:new Date().toISOString(),status:'connected'}:x));
  }catch(e){setError('Teste de conexão não concluído: '+safe(e))}
  finally{setWorking('')}
 }
 async function searchCrm(e){
  e?.preventDefault();
  if(crmQuery.trim().length<3||working)return;
  setWorking('crm');setError('');setCrmResult(null);
  try{
   const result=await request('/api/openbot/crm/search?q='+encodeURIComponent(crmQuery.trim()));
   setCrmResult(result);
  }catch(e){setError('Pesquisa CRM não concluída: '+safe(e))}
  finally{setWorking('')}
 }
 async function grantMcp(){
  const clientId=mcpClient.trim();
  if(!clientId||working)return;
  setWorking('mcp');setError('');setNotice('');
  try{
   const result=await request('/api/openbot/mcp/settings',{method:'POST',
    body:JSON.stringify({clientId,editScope})});
   setMcp(old=>({...old,grants:[result.grant,...(old?.grants||[]).filter(g=>g.client_id!==clientId)]}));
   setMcpClient('');setNotice(result.notice);
  }catch(e){setError('MCP não habilitado: '+safe(e))}
  finally{setWorking('')}
 }
 async function reviewEdit(id,approve){
  if(working)return;
  if(approve&&confirmEditId!==id){setConfirmEditId(id);return}
  setWorking(id);setError('');setNotice('');
  try{
   const result=await request('/api/openbot/mcp/edits',{method:'POST',
    body:JSON.stringify({proposalId:id,approve})});
   const status=result.review?.status||'unknown';
   setNotice(status==='applied'?'Alteração aplicada e registrada com auditoria.':
     status==='rejected'?'Proposta rejeitada.':
     status==='conflict'?'Registro alterado por outra pessoa. Solicite nova proposta.':'Revisão registrada: '+status);
   setEditRequests(old=>old.map(p=>p.id===id?{...p,status,reviewed_at:new Date().toISOString()}:p));
   setConfirmEditId('');
  }catch(e){setError('Não foi possível revisar a alteração: '+safe(e))}
  finally{setWorking('')}
 }
 async function revokeMcp(id){
  if(working)return;setWorking('mcp');setError('');setNotice('');
  try{
   const result=await request('/api/openbot/mcp/settings',{method:'DELETE',
    body:JSON.stringify({id})});
   setMcp(old=>({...old,grants:old.grants.filter(g=>g.id!==id)}));setNotice(result.notice);
  }catch(e){setError('Não foi possível revogar o cliente: '+safe(e))}
  finally{setWorking('')}
 }
 function openZapFast(){
  if(window.killaDesktop?.openZapFast)window.killaDesktop.openZapFast().catch(e=>setError(safe(e)));
  else openExternal(ZAPFAST_SINGLE_SESSION_URL);
 }
 function copy(text){
  if(!navigator.clipboard?.writeText){setError('Copie o endereço manualmente.');return}
  navigator.clipboard.writeText(text).then(()=>setNotice('Endereço copiado.'))
   .catch(()=>setError('Não foi possível copiar.'));
 }
 const activeAccounts=c=>c.mode==='composio'?composioAccounts.filter(a=>a.toolkit===c.composioToolkit&&a.connected):accounts.filter(a=>a.provider===c.provider&&a.status==='connected');
 const hasConnectorScopes=(c,a)=>!c.scopes?.length||c.scopes.every(scope=>(a.scopes||[]).includes(scope));
 const statusOf=c=>{
  if(c.mode==='composio')return !c.configured?['Configuração necessária','off']:activeAccounts(c).length?['Conectado','good']:['Pronto para conectar','ready'];
  if(c.mode==='native')return ['Ativo','good'];
  if(c.mode==='separate')return ['Separado','neutral'];
  if(c.mode==='planned')return ['Ainda indisponível','off'];
  if(!c.configured)return ['Configuração necessária','off'];
  if(activeAccounts(c).some(a=>hasConnectorScopes(c,a)))return ['Conectado','good'];
  if(activeAccounts(c).length)return ['Permissão pendente','ready'];
  return ['Pronto para autorizar','ready'];
 };

 return <div className={css.root} role="dialog" aria-modal="true" aria-label="Aplicativos conectados">
  <aside className={css.left}>
   <div className={css.heading}><span className={css.brand}><Puzzle size={22}/></span><div><strong>APLICATIVOS</strong><small>OpenBot · W1 Capital</small></div></div>
   <p className={css.leftCaption}>Integrações e permissões individuais, como no painel de conexões do OpenMausBot.</p>
   <nav aria-label="Áreas de conexão">
    <button className={tab==='apps'?css.navSelected:''} onClick={()=>{setTab('apps');moveTo('')}}><Plug size={17}/> Meus aplicativos</button>
    <button className={tab==='crm'?css.navSelected:''} onClick={()=>{setTab('crm');moveTo('crm')}}><Building2 size={17}/> INFINITUM CRM</button>
    <button className={tab==='mcp'?css.navSelected:''} onClick={()=>{setTab('mcp');moveTo('')}}><Link2 size={17}/> MCP · MausBot</button>
   </nav>
   <div className={css.leftBottom}><ShieldCheck size={17}/> As conexões pertencem à sua conta. Nenhum agente recebe tokens ou permissão para enviar mensagens automaticamente.</div>
  </aside>
  <main className={css.center}>
   <header className={css.top}><div><h1>{tab==='apps'?'Aplicativos conectados':tab==='crm'?'Conexão com o CRM':'MCP · OpenMausBot'}</h1>
    <p>{tab==='apps'?'Conecte contas diretamente, consulte as permissões e teste o acesso.':tab==='crm'?'Pesquise seus dados autorizados sem sair do OpenBot.':'Conecte o OpenMausBot por MCP HTTP, com OAuth e autorização individual.'}</p></div>
    <div className={css.topActions}><button title="Atualizar conexões" aria-label="Atualizar" onClick={refresh}><RefreshCw size={18}/></button>
     <button title="Voltar ao chat" aria-label="Fechar integrações" onClick={onClose}><X size={19}/></button></div>
   </header>
   <div className={css.content}>
    {error&&<div role="alert" className={css.error}><AlertCircle size={16}/>{error}<button onClick={()=>setError('')}>×</button></div>}
    {notice&&<div role="status" className={css.notice}><Check size={16}/>{notice}<button onClick={()=>setNotice('')}>×</button></div>}
    {loading?<div className={css.loading}><Loader2 className={css.spin}/> Carregando conexões autorizadas…</div>:
    tab==='apps'?<>
     {selected&&connector?<section className={css.detail}>
      <button className={css.back} onClick={()=>moveTo('')}><ArrowLeft size={15}/> Todos os aplicativos</button>
      <div className={css.detailHeading}><span className={css.appIcon}>{(()=>{const Icon=ICONS[connector.id]||Plug;return <Icon size={27}/>})()}</span>
       <div><h2>{connector.name}</h2><p>{connector.description}</p></div>
      </div>
      {connector.mode==='native'?<>
       <p className={css.info}>Acesso interno ao CRM. As consultas são autenticadas, limitadas à empresa e ao usuário, e somente leitura.</p>
       <button className={css.primary} onClick={()=>setTab('crm')}>Pesquisar agora <ChevronRight size={16}/></button>
      </>:connector.mode==='separate'?<>
       <p className={css.info}>O WhatsApp usa uma sessão isolada no ZapFast. O OpenBot não copia credenciais, não altera número e não envia mensagens.</p>
       <button className={css.primary} onClick={openZapFast}><MessageCircle size={16}/> Abrir WhatsApp · ZapFast</button>
       <a className={css.secondaryLink} href={new URL('/trocar-numero',ZAPFAST_SINGLE_SESSION_URL).toString()} target="_blank" rel="noopener noreferrer">Trocar número no ZapFast <ExternalLink size={14}/></a>
      </>:connector.mode==='composio'?<>
       <p className={css.info}>A conexão é feita pelo Composio em nuvem. A chave da API fica somente na Vercel; o navegador e o EXE não recebem credenciais privadas.</p>
       {connector.composioToolkit==='whatsapp'&&<p className={css.warning}>Este conector exige uma conta WhatsApp Business (WABA). Ele não conecta um WhatsApp pessoal por QR Code. Para QR Code e número pessoal, use o ZapFast remoto.</p>}
       <div className={css.subheading}><h3>Contas autorizadas no Composio</h3><span>{connectorAccounts.length} registro(s)</span></div>
       {connectorAccounts.map(a=><div key={a.connectedAccountId} className={css.account}>
        <div><strong>{a.alias||a.name||'Conta conectada'}</strong><small>{a.toolkit} · {a.status==='ACTIVE'?'Conectada':a.status}</small>
         <small>ID da conta: {a.connectedAccountId}</small></div>
        <div className={css.accountActions}>
         <button disabled={!!working} onClick={()=>refresh()}><RefreshCw size={14}/> Atualizar estado</button>
         <button disabled={!!working} onClick={()=>disconnectComposio(a)} className={css.danger}>{confirmRemove===a.connectedAccountId?'Confirmar remoção':'Desconectar'}</button>
        </div>
       </div>)}
       {!connectorAccounts.length&&<p className={css.info}>Nenhuma conta autorizada. Clique abaixo para iniciar o OAuth seguro do Composio.</p>}
       <button className={css.primary} disabled={!!working||!connector.configured} onClick={()=>beginComposio(connector)}>
        {working===connector.id?<Loader2 className={css.spin} size={16}/>:<Plug size={16}/>}
        {connectorAccounts.length?'Conectar outra conta':'Conectar com Composio'}
       </button>
       <p className={css.muted}>As conexões ficam vinculadas ao usuário autenticado no INFINITUM e são mantidas pelo Composio. O servidor roda na Vercel, não neste computador.</p>
      </>:connector.mode==='planned'?<p className={css.info}>Integração ainda sem OAuth implementado. Não há botão de conexão fictício.</p>:<>
       <div className={css.subheading}><h3>Suas contas {connector.provider==='google'?'Google':'Meta'}</h3>
        <span>{connectorAccounts.length} registro(s)</span></div>
       {connectorAccounts.map(a=><div key={a.id} className={css.account}>
        <div><strong>{a.display_name||a.email||'Conta conectada'}</strong><small>{a.email||a.external_account_id} · {hasConnectorScopes(connector,a)?'Permissão concedida':'Permissão adicional necessária'}</small>
         <small>Verificada: {age(a.last_checked_at)}</small></div>
        <div className={css.accountActions}>
         {hasConnectorScopes(connector,a)?<button disabled={!!working} onClick={()=>previewData(a)}>{working===a.id?<Loader2 className={css.spin} size={14}/>:<RefreshCw size={14}/>} Testar acesso</button>:<button disabled={!!working||!connector.configured} onClick={()=>begin(connector)}><Plug size={14}/> Conceder permissão</button>}
         <button disabled={!!working} onClick={()=>disconnect(a)} className={css.danger}>{confirmRemove===a.id?'Confirmar remoção':'Desconectar'}</button>
        </div>
       </div>)}
       {!connectorAccounts.length&&<p className={css.info}>Nenhuma conta OAuth autorizada deste provedor.</p>}
       {connector.configured?
        <button className={css.primary} disabled={!!working} onClick={()=>begin(connector)}>
         {working===connector.id?<Loader2 className={css.spin} size={16}/>:<Plug size={16}/>}
         {connectorAccounts.length?'Conectar outra conta':'Conectar conta'} </button>:
        <p className={css.warning}>O aplicativo OAuth deste provedor ainda não tem credenciais configuradas no servidor. O administrador precisa registrar o aplicativo no Google Cloud ou Meta for Developers e configurar as chaves privadas. Não cole senhas aqui.</p>}
       {preview&&<section className={css.preview}><button type="button" className={css.primary}
        onClick={()=>{
         const rows=(preview.items||[]).slice(0,10).map(x=>({id:x.id,name:x.name||x.username||x.page||'',url:x.url||'',text:x.text||x.snippet||'',from:x.from||x.sender||'',start:x.start||'',end:x.end||'',date:x.date||x.publishedAt||''}));
         onUseData?.('Fonte autorizada: '+(SERVICE_LABELS[preview.service]||preview.service)+
          '\nConferido em: '+preview.checkedAt+'\nItens: '+JSON.stringify(rows)+'\n\nExplique ou organize estes dados; não invente informações ausentes.');
        }}><Copy size={15}/> Usar resultados no chat</button><h3>{SERVICE_LABELS[preview.service]||preview.service} · teste confirmado</h3>
        <p>Itens autorizados encontrados: {preview.items?.length||0}. Nenhuma mensagem ou postagem foi enviada.</p>
        {(preview.items||[]).slice(0,12).map(x=><div key={x.id} className={css.previewRow}>
         <span>{x.name||x.username||x.page||x.id}{x.text&&<small>{x.text}</small>}</span>
         {preview.service==='chat'&&x.resourceName&&<button type="button" disabled={!!working} onClick={()=>previewChatMessages(x.resourceName)}>Ler mensagens</button>}
         {x.url&&/^https:\/\//.test(x.url)&&<a href={x.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/></a>}
        </div>)}</section>}
      </>}
     </section>:<>
      <div className={css.intro}><span><LockKeyhole size={18}/></span><p>Conexões separadas por conta. Os serviços Google usam autorização por conta e permissões específicas; conecte somente o que pretende consultar. Nenhum token fica no navegador.</p></div>
      {GROUPS.map(group=>groupItems(group).length>0&&<section key={group} className={css.group}><h2>{group}</h2><div className={css.grid}>
       {groupItems(group).map(c=>{const Icon=ICONS[c.id]||Plug;const [label,kind]=statusOf(c);return <button type="button" className={css.card} key={c.id} onClick={()=>moveTo(c.id)}>
        <span className={css.cardTop}><span className={css.appIcon}><Icon size={23}/></span><ChevronRight size={16}/></span>
        <strong>{c.name}</strong><small>{c.description}</small>
        <span className={css.state+' '+css[kind]}>{kind==='good'&&<Check size={12}/>} {label}</span>
       </button>})}
      </div></section>)}
     </>}
    </>:tab==='crm'?<section className={css.crm}>
     <div className={css.info}>A pesquisa consulta o INFINITUM diretamente no Supabase, respeitando os limites da sua empresa e as políticas de acesso. Não consulta o DJEN nem o DataJud.</div>
     <form className={css.crmForm} onSubmit={searchCrm}><Search size={19}/>
      <input aria-label="Pesquisar no CRM" placeholder="Digite nome ou número do processo" minLength={3} maxLength={80}
       value={crmQuery} onChange={e=>setCrmQuery(e.target.value)}/>
      <button disabled={crmQuery.trim().length<3||!!working}>{working==='crm'?'Pesquisando…':'Pesquisar'}</button></form>
     {crmResult&&<><button type="button" className={css.primary}
       onClick={()=>onUseData?.('Resultados confirmados no CRM em '+crmResult.asOf+
        '\nClientes: '+JSON.stringify((crmResult.clients||[]).slice(0,8))+
        '\nProcessos: '+JSON.stringify((crmResult.cases||[]).slice(0,8))+
        '\nFontes incompletas: '+(crmResult.partial?'sim':'não')+
        '\n\nPrepare um resumo sem inventar movimentações ou dados externos.')}>
       <Copy size={15}/> Usar resultados no chat</button><p className={css.muted}>{crmResult.partial?'Fontes incompletas — confira os avisos.':'Pesquisa concluída.'} Consulta em {age(crmResult.asOf)}.</p>
      {(crmResult.errors||[]).map((e,i)=><p className={css.warning} key={i}>{e}</p>)}
      <h3>Clientes ({crmResult.clients?.length||0})</h3>
      {crmResult.clients?.length?crmResult.clients.map(x=><div className={css.result} key={x.source+x.id}><strong>{x.name}</strong><small>{x.source} · {x.stage||x.status||'Sem status informado'}</small></div>):<p className={css.muted}>Nenhum cliente encontrado nas fontes consultadas.</p>}
      <h3>Processos ({crmResult.cases?.length||0})</h3>
      {crmResult.cases?.length?crmResult.cases.map(x=><div className={css.result} key={x.source+x.id}><strong>{x.process_number||x.title}</strong><small>{x.source} · {x.status||x.process_type||'Sem fase informada'}</small></div>):<p className={css.muted}>Nenhum processo encontrado nas fontes consultadas.</p>}
     </>}
    </section>:<section className={css.mcp}>
      <div className={css.info}><ShieldCheck size={19}/> A conexão MCP permite que o MausBot consulte clientes, processos e status de aplicativos em modo somente leitura. Envio de WhatsApp, Gmail e alterações no CRM permanecem bloqueados.</div>
      <label className={css.copyLabel}>Endereço do servidor MCP HTTP</label>
      <div className={css.copyLine}><code>{mcp?.mcpUrl||'https://agentinfinitum.vercel.app/api/openbot/mcp'}</code>
       <button onClick={()=>copy(mcp?.mcpUrl||'https://agentinfinitum.vercel.app/api/openbot/mcp')} aria-label="Copiar MCP"><Copy size={17}/></button></div>
      <p className={css.muted}>No OpenMausBot: Aplicativos → MCP → Adicionar servidor HTTP. Cole o endereço acima e autorize sua conta INFINITUM por OAuth.</p>
      <h3>Clientes OAuth autorizados</h3>
      <p className={css.muted}>MFA nesta sessão: <strong>{mcp?.mfaVerified?'Confirmado':'Não confirmado'}</strong>. O Supabase precisa ter o servidor OAuth 2.1 ativado e o consentimento configurado para o OpenBot.</p>
      <form className={css.crmForm} onSubmit={e=>{e.preventDefault();grantMcp()}}><KeyRound size={17}/>
       <input aria-label="ID público OAuth" value={mcpClient} onChange={e=>setMcpClient(e.target.value)}
        maxLength={200} placeholder="ID público OAuth do MausBot" />
       <button disabled={!!working||!mcp?.mfaVerified||mcpClient.trim().length<5}>Autorizar</button></form>
      <label className={css.info} style={{marginBottom:10,gap:10,alignItems:'center'}}>
       <input type="checkbox" checked={editScope==='reviewed_edit'}
        onChange={e=>setEditScope(e.target.checked?'reviewed_edit':'read')}/>
       <span>Conceder edição supervisionada: o MausBot pode propor mudanças em notas, responsáveis, retornos e prioridades. Cada alteração exige aprovação humana com MFA; nunca há execução automática.</span>
      </label>
      {(mcp?.grants||[]).map(g=><div key={g.id} className={css.account}><div><strong>{g.client_id}</strong><small>Expira: {age(g.expires_at)} · {g.enabled?'Permitido':'Inativo'} · {g.edit_scope==='reviewed_edit'?'Edição supervisionada':'Somente leitura'}</small></div>
       <button className={css.danger} disabled={!!working} onClick={()=>revokeMcp(g.id)}>Revogar</button></div>)}
      {!(mcp?.grants||[]).length&&<p className={css.muted}>Nenhum cliente externo autorizado nesta conta.</p>}
      <h3>Edições propostas pelo MausBot</h3>
      <p className={css.muted}>O agente pode solicitar alterações, mas nenhuma é feita até você aprovar. Propostas expiram em 30 minutos, mudanças simultâneas são bloqueadas e tudo fica registrado.</p>
      {editRequests.filter(p=>p.status==='pending').length===0&&<p className={css.info}>Nenhuma alteração pendente de aprovação.</p>}
      {editRequests.filter(p=>p.status==='pending').map(p=><div key={p.id} className={css.account} style={{alignItems:'flex-start'}}>
       <div style={{flex:1,minWidth:0}}>
        <strong>{p.field_label||p.field_name} · {p.target_table}</strong>
        <small>ID: {p.target_id}</small>
        <small>Novo valor: {p.new_value}</small>
        <small>Justificativa do agente: {p.reason}</small>
        <small>Solicitado por: {p.client_id} · Expira: {new Date(p.expires_at).toLocaleString('pt-BR')}</small>
       </div>
       <div className={css.accountActions}>
        <button disabled={!!working||!mcp?.mfaVerified||Date.parse(p.expires_at)<Date.now()}
         onClick={()=>reviewEdit(p.id,true)}>
         {confirmEditId===p.id?'Confirmar aplicação':'Aprovar alteração'}</button>
        <button className={css.danger} disabled={!!working} onClick={()=>reviewEdit(p.id,false)}>Rejeitar</button>
       </div>
      </div>)}
      {editRequests.some(p=>p.status==='applied')&&<p className={css.muted}>Alterações já aplicadas e auditadas: {editRequests.filter(p=>p.status==='applied').length}</p>}
      <p className={css.warning}>O OAuth precisa ser habilitado em Supabase → Authentication → OAuth Server. Se o cliente não conectar, verifique o consentimento em /oauth/consent e confirme o segundo fator.</p>
     </section>}
   </div>
  </main>
 </div>;
}
