'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {Activity,AlertTriangle,ArrowRight,Bell,BriefcaseBusiness,CheckCircle2,ChevronDown,Filter,Grid2X2,Headset,Home,Layers,Link2,MessageSquare,MoreHorizontal,Play,Plus,RefreshCw,Search,Settings,ShieldCheck,Sparkles,Star,Users,Workflow,Zap,Plug,BarChart3,X,Scale} from 'lucide-react';
import {OPENBOT_BOTS} from '../lib/openbot-studio-config.mjs';
import OpenBotStudio from './openbot-studio.jsx';
import OpenCodeDevicePanel from './opencode-device-panel.jsx';
import s from './agents-command-center.module.css';

const AGENTS=[
 {id:'hermes',botKey:'killa',name:'Hermes',role:'Comercial · Coordenação e produtividade',area:'Operações',avatar:'/agents/hermes.webp',description:'Organiza solicitações, resume informações e prepara rascunhos para revisão.',skills:['Conversas','Resumos','Rascunhos']},
 {id:'atlas',botKey:'atlas',name:'Atlas',role:'Pesquisa · Evidências e comparações',area:'Operações',avatar:'/agents/atlas.webp',description:'Estrutura pesquisas, compara informações e organiza evidências sem inventar fontes.',skills:['Pesquisa','Comparações','Evidências']},
 {id:'nox',botKey:'nox',name:'Nox',role:'Inteligência · Análise e risco',area:'Inteligência',avatar:'/agents/nox.webp',description:'Ajuda a identificar padrões, riscos e prioridades a partir dos dados fornecidos.',skills:['Análise','Riscos','Prioridades']},
 {id:'vega',botKey:'scout',name:'Vega',role:'Comercial · Prospecção e conversão',area:'Comercial',avatar:'/agents/vega.webp',description:'Prepara propostas, mensagens comerciais e critérios de qualificação de oportunidades.',skills:['Propostas','Mensagens','Qualificação']},
 {id:'lyra',botKey:'echo',name:'Lyra',role:'Atendimento · Relacionamento e suporte',area:'Atendimento',avatar:'/agents/lyra.webp',description:'Redige respostas cordiais e organiza retornos para revisão humana.',skills:['Atendimento','Respostas','Retornos']},
 {id:'oraculo-juridico',botKey:'lexis',name:'Oráculo Jurídico',role:'Jurídico · Contratos e conformidade',area:'Jurídico',avatar:'/agents/oraculo-juridico.webp',description:'Elabora minutas e revisa informações jurídicas sem inventar fontes ou movimentações.',skills:['Minutas','Revisão','Análise jurídica']}
];
const NAV=[
 {label:'Início',href:'/dashboard',icon:Home},{label:'CRM',href:'/processos',icon:BriefcaseBusiness},{label:'Negócios',href:'/leads',icon:Workflow},{label:'Contatos',href:'/clientes',icon:Users},{label:'Agentes',href:'/agentes',icon:Sparkles,active:true},{label:'Automação',href:'/tarefas',icon:Zap},{label:'Conectores',href:'/integracoes',icon:Plug},{label:'Relatórios',href:'/relatorios',icon:BarChart3},{label:'Configurações',href:'/configuracoes',icon:Settings}
];
const textOf=v=>typeof v==='string'?v:(v==null?'':JSON.stringify(v));
const ago=v=>{const d=new Date(v);if(Number.isNaN(d.getTime()))return '—';const n=Math.max(0,Math.floor((Date.now()-d.getTime())/60000));if(n<1)return 'Agora';if(n<60)return 'Há '+n+' min';if(n<1440)return 'Há '+Math.floor(n/60)+' h';return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});};
const dateLabel=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});};
const stateFor=v=>{const x=String(v||'').toLowerCase();if(/complete|success|done|conclu/.test(x))return {label:'Concluído',kind:'success'};if(/fail|error|erro/.test(x))return {label:'Falhou',kind:'danger'};if(/pend|wait|review|approval|aprova|running|process/.test(x))return {label:'Em andamento',kind:'warning'};return {label:v||'Registrado',kind:'neutral'};};

export default function AgentsCommandCenter({db,session}){
 const owner=session&&session.user?session.user.id:null;
 const [threads,setThreads]=useState([]),[runs,setRuns]=useState([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[updated,setUpdated]=useState(null);
 const [selectedId,setSelectedId]=useState('hermes'),[query,setQuery]=useState(''),[tab,setTab]=useState('Todos'),[filter,setFilter]=useState('Tudo'),[favorites,setFavorites]=useState([]),[modal,setModal]=useState(false);
 const [view,setView]=useState('team'),[chatBotKey,setChatBotKey]=useState('killa'),[chatThreadId,setChatThreadId]=useState(null),[chatStartNew,setChatStartNew]=useState(false),[chatNonce,setChatNonce]=useState(0);
 const refresh=useCallback(async()=>{
  if(!db||!owner){setLoading(false);return;}
  try{
   const results=await Promise.all([
    db.from('openbot_threads').select('id,bot_key,title,updated_at,created_at').eq('owner_id',owner).order('updated_at',{ascending:false}).limit(100),
    db.from('office_agent_runs').select('id,task,result,created_at,status,agent').eq('owner_id',owner).order('created_at',{ascending:false}).limit(30)
   ]);
   if(!results[0].error)setThreads(results[0].data||[]);
   if(!results[1].error)setRuns(results[1].data||[]);
   setLoadError(results.some(r=>r.error)?'Alguns registros de atividade não puderam ser carregados.':'');
   setUpdated(new Date());
  }catch{setLoadError('Não foi possível atualizar o painel agora.');}
  finally{setLoading(false);}
 },[db,owner]);
 useEffect(()=>{let alive=true;const run=()=>{if(alive)refresh();};run();const id=window.setInterval(run,30000);window.addEventListener('focus',run);return()=>{alive=false;window.clearInterval(id);window.removeEventListener('focus',run);};},[refresh]);
 const latest=useMemo(()=>{const m={};threads.forEach(t=>{if(!m[t.bot_key])m[t.bot_key]=t;});return m;},[threads]);
 const selected=AGENTS.find(a=>a.id===selectedId)||AGENTS[0];

 const openAgent=(agent,{newConversation=false,threadId=null,integrations=false}={})=>{
  if(!agent)return;
  const targetThread=threadId||(!newConversation?latest[agent.botKey]?.id||null:null);
  setSelectedId(agent.id);setChatBotKey(agent.botKey);setChatThreadId(targetThread);
  setChatStartNew(newConversation);setChatNonce(value=>value+1);setView('chat');
  const params=new URLSearchParams({view:'chat',bot:agent.botKey});
  if(targetThread)params.set('thread',targetThread);
  if(newConversation)params.set('new','1');
  if(integrations)params.set('integrations','1');
  window.history.pushState({agentsView:'chat'},'','/agentes?'+params.toString());
 };
 const backToTeam=()=>{
  setView('team');setChatThreadId(null);setChatStartNew(false);
  window.history.pushState({agentsView:'team'},'','/agentes');
 };
 useEffect(()=>{
  const syncFromUrl=()=>{
   const params=new URLSearchParams(window.location.search),botKey=params.get('bot');
   if(params.get('view')==='chat'&&OPENBOT_BOTS.some(bot=>bot.key===botKey)){
    const agent=AGENTS.find(item=>item.botKey===botKey);
    setSelectedId(agent?.id||'hermes');setChatBotKey(botKey);
    setChatThreadId(params.get('thread')||null);setChatStartNew(params.get('new')==='1');
    setChatNonce(value=>value+1);setView('chat');
   }else setView('team');
  };
  syncFromUrl();window.addEventListener('popstate',syncFromUrl);
  return()=>window.removeEventListener('popstate',syncFromUrl);
 },[]);
 const visibleAgents=AGENTS.filter(a=>(a.name+' '+a.role+' '+a.area+' '+a.description).toLowerCase().includes(query.toLowerCase())&&(tab!=='Favoritos'||favorites.includes(a.id)));
 const visibleRuns=runs.filter(r=>{const t=(textOf(r.task)+' '+textOf(r.status)+' '+textOf(r.agent)).toLowerCase();if(filter==='Aprovações')return /aprova|approval|review/.test(t);if(filter==='Pendências')return /pend|wait|review|approval|aprova/.test(t);if(filter==='Execuções')return !/aprova|approval|review|pend|wait/.test(t);return true;});
 const initials=String(session&&session.user&&session.user.email||'I').slice(0,1).toUpperCase();
 const toggleFav=id=>setFavorites(old=>old.includes(id)?old.filter(x=>x!==id):old.concat(id));
 const agentLabel=r=>{const k=String(r.agent||'').toLowerCase();const a=AGENTS.find(x=>x.botKey===k||x.id===k);return a?a.name:(k==='superagente'?'Superagente':'INFINITUM');};
 return <div className={s.page}>
  <header className={s.topbar}>
   <Link href="/dashboard" className={s.brand}><img src="/branding/infinitum-symbol-branco.svg" alt="" width="36" height="20"/><b>Infinitum<small>CRM</small></b></Link>
   <div className={s.heading}><span><Users size={22}/></span><div><h1>Agentes</h1><p>Sua equipe de agentes de IA. Coordene, monitore e escale operações.</p></div></div>
   <div className={s.topActions}><span className={s.secure}><i/> <ShieldCheck size={15}/> Sessão autenticada</span><button aria-label="Notificações"><Bell size={18}/></button><button aria-label="Ajuda" className={s.help}>?</button><div className={s.user}><b>{initials}</b><span>Infinitum<small>{session&&session.user&&session.user.email||'Conta autenticada'}</small></span><ChevronDown size={14}/></div></div>
  </header>
  <div className={s.workspace+(view==='chat'?' '+s.workspaceChat:'')}>
   <nav className={s.nav}>{NAV.map(item=>{const I=item.icon;return <Link key={item.label} href={item.href} className={[s.navLink,item.active?s.navActive:''].join(' ')}><I size={19}/><span>{item.label}</span></Link>;})}<div className={s.navFoot}><img src="/branding/infinitum-symbol-branco.svg" alt="" width="36" height="20"/><small>INFINITUM IA</small></div></nav>
   <aside className={s.roster}>
    <div className={s.search}><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar agente, equipe ou tarefa..."/><kbd>⌘ K</kbd></div>
    <div className={s.rosterTabs}>{['Todos','Equipes','Favoritos'].map(v=><button key={v} className={tab===v?s.activeTab:''} onClick={()=>setTab(v)}>{v}</button>)}<button aria-label="Filtrar" onClick={()=>setTab('Todos')}><Filter size={15}/></button></div>
    <div className={s.rosterList}>{visibleAgents.map(a=>{const t=latest[a.botKey];return <div key={a.id} className={[s.rosterItem,selectedId===a.id?s.rosterSelected:''].join(' ')}><button onClick={()=>openAgent(a)} className={s.rosterMain} aria-label={'Abrir conversa com '+a.name}><span className={s.rosterAvatar}><img src={a.avatar} alt=""/><i/></span><span className={s.rosterCopy}><b>{a.name}</b><small>{t&&t.title||'Nenhuma conversa iniciada'}</small></span><time>{t?ago(t.updated_at):'—'}</time></button><button className={[s.favorite,favorites.includes(a.id)?s.favOn:''].join(' ')} aria-label="Favoritar" onClick={()=>toggleFav(a.id)}><Star size={13} fill={favorites.includes(a.id)?'currentColor':'none'}/></button></div>;})}{!visibleAgents.length&&<p className={s.emptySmall}>Nenhum agente encontrado.</p>}</div>
    <div className={s.historyHeading}><span>Histórico de conversas</span><small>{threads.length}</small></div>
    <div className={s.historyList}>{threads.slice(0,7).map(t=>{const a=AGENTS.find(x=>x.botKey===t.bot_key);return a?<button key={t.id} title={t.title} onClick={()=>openAgent(a,{threadId:t.id})}><MessageSquare size={13}/><span><b>{t.title||'Nova conversa'}</b><small>{a.name} · {ago(t.updated_at)}</small></span></button>:null;})}{!threads.length&&<p>Nenhuma conversa salva.</p>}</div>
    <button className={s.rosterNew} onClick={()=>setModal(true)}><Plus size={17}/> Nova conversa</button>
   </aside>
   {view==='chat'?<div className={s.chatHost}><OpenBotStudio key={chatBotKey+'-'+(chatThreadId||'latest')+'-'+chatNonce} db={db} session={session} initialBot={chatBotKey} initialThreadId={chatThreadId} startNew={chatStartNew} embedded onBack={backToTeam} activityRuns={runs.filter(r=>agentLabel(r)===AGENTS.find(a=>a.botKey===chatBotKey)?.name)}/></div>:<main className={s.main}><OpenCodeDevicePanel db={db}/>
    <div className={s.teamHead}><span className={s.teamIcon}><Users size={21}/></span><div><h2>Equipe de Operações <ChevronDown size={15}/></h2><p>6 perfis especializados · conversas privadas · revisão humana</p></div><div className={s.teamAvatars}>{AGENTS.slice(0,3).map(a=><img key={a.id} src={a.avatar} alt=""/>)}<span>+3</span></div></div>
    <div className={s.tabs}><button className={s.tabActive}><Grid2X2 size={14}/> Visão da equipe</button><button onClick={()=>openAgent(selected)}><MessageSquare size={14}/> Conversas</button><Link href="/tarefas"><CheckCircle2 size={14}/> Tarefas</Link><Link href="/relatorios"><Activity size={14}/> Desempenho</Link><Link href="/configuracoes"><Settings size={14}/> Configurações</Link></div>
    <div className={s.toolbar}><button className={s.primary} onClick={()=>openAgent(selected,{newConversation:true})}><Plus size={16}/> Nova conversa</button><button onClick={()=>openAgent(selected,{integrations:true})}><Link2 size={15}/> Conectar apps</button><button onClick={()=>openAgent(selected)}><Layers size={15}/> Modelos e motor</button><Link href="/mcp/approve"><CheckCircle2 size={15}/> Aprovações</Link></div>
    {loadError&&<div className={s.notice}><AlertTriangle size={14}/>{loadError}</div>}
    <div className={s.grid}>{AGENTS.map(a=>{const profile=OPENBOT_BOTS.find(b=>b.key===a.botKey);const t=latest[a.botKey];return <article key={a.id} className={[s.card,selectedId===a.id?s.cardSelected:''].join(' ')}><div className={s.cardTop}><button className={s.cardAvatarButton} aria-label={'Abrir conversa com '+a.name} onClick={()=>openAgent(a)}><img src={a.avatar} alt={'Retrato de '+a.name}/></button><span className={s.ready}><i/> Disponível</span><button aria-label="Mais opções" onClick={()=>setSelectedId(a.id)}><MoreHorizontal size={17}/></button></div><h3><button className={s.agentNameButton} onClick={()=>openAgent(a)}>{a.name}</button></h3><p className={s.role}>{a.role}</p><div className={s.mission}><small>Especialidade</small><p>{a.description}</p></div><div className={s.skills}>{(profile&&profile.skills||a.skills).slice(0,3).map(x=><span key={x}>{x}</span>)}</div><div className={s.meta}><span><ShieldCheck size={13}/> Perfil configurado</span><span>{t?'Conversa '+ago(t.updated_at).toLowerCase():'Aguardando conversa'}</span></div><div className={s.cardActions}><button onClick={()=>openAgent(a)}><MessageSquare size={14}/> Abrir chat</button><button aria-label={'Nova conversa com '+a.name} onClick={()=>openAgent(a,{newConversation:true})}><Play size={14}/></button></div></article>;})}</div>
    <section className={s.teams}><div><h3><Users size={17}/> Equipes</h3><p>Perfis agrupados por área de atuação.</p></div><div className={s.teamTiles}>{[['Atendimento','Lyra',Headset],['Jurídico','Oráculo Jurídico',Scale],['Operações','Hermes e Atlas',Layers],['Comercial','Vega',BriefcaseBusiness],['Inteligência','Nox',Activity]].map(([name,detail,I])=><button key={name} onClick={()=>{const a=AGENTS.find(x=>x.area===name)||AGENTS.find(x=>x.name===detail);if(a)openAgent(a);}}><I size={18}/><span><b>{name}</b><small>{detail}</small></span><ArrowRight size={13}/></button>)}</div></section>
   </main>}
   <aside className={s.activityPanel}>
    <div className={s.activityHead}><div><Activity size={20}/><h2>Atividade ao vivo</h2></div><span className={s.live}><i/> Atualização automática</span><p>Execuções, ferramentas, aprovações e pendências.</p></div>
    <div className={s.filters}>{['Tudo','Execuções','Aprovações','Pendências'].map(v=><button key={v} className={filter===v?s.filterActive:''} onClick={()=>setFilter(v)}>{v}</button>)}</div>
    <div className={s.activityList}>{loading?<div className={s.activityEmpty}><RefreshCw size={18}/> Carregando atividade...</div>:visibleRuns.length?visibleRuns.slice(0,12).map(r=>{const st=stateFor(r.status);return <article className={s.activityItem} key={r.id}><span className={[s.marker,s[st.kind]].join(' ')}>{st.kind==='success'?<CheckCircle2 size={15}/>:st.kind==='danger'?<AlertTriangle size={15}/>:<Zap size={15}/>}</span><div><div className={s.activityTitle}><b>{textOf(r.task)||'Execução registrada'}</b><time>{ago(r.created_at)}</time></div><p>{agentLabel(r)} · {dateLabel(r.created_at)}</p><span className={[s.status,s[st.kind]].join(' ')}>{st.label}</span></div></article>; }):<div className={s.activityEmpty}><Activity size={22}/><b>Nenhuma atividade nesta categoria</b><span>{runs.length?'Tente outro filtro.':'As execuções registradas aparecerão aqui.'}</span></div>}</div>
    <div className={s.activityFoot}><span>{updated?'Atualizado '+updated.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Aguardando dados'}</span><button aria-label="Atualizar" onClick={refresh}><RefreshCw size={14}/></button><Link href="/superagente">Ver histórico completo <ArrowRight size={14}/></Link></div>
   </aside>
  </div>
  {modal&&<div className={s.backdrop} onClick={()=>setModal(false)}><section className={s.modal} role="dialog" aria-modal="true" aria-labelledby="agent-modal-title" onClick={e=>e.stopPropagation()}><button className={s.close} onClick={()=>setModal(false)} aria-label="Fechar"><X size={17}/></button><small>INFINITUM · AGENTES</small><h2 id="agent-modal-title">Nova conversa</h2><p>Escolha um perfil para iniciar uma nova conversa privada.</p><div className={s.modalList}>{AGENTS.map(a=><button key={a.id} onClick={()=>{setModal(false);openAgent(a,{newConversation:true});}}><img src={a.avatar} alt=""/><span><b>{a.name}</b><small>{a.role}</small></span><ArrowRight size={15}/></button>)}</div></section></div>}
 </div>;
}
