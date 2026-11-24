'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {Activity,AlertTriangle,ArrowRight,BarChart3,CalendarDays,CheckCircle2,Clock3,FileWarning,Gavel,RefreshCw,Scale,Users,FileText,ClipboardList} from 'lucide-react';
import {loadLexisCompanySources} from '../lib/lexis-company-data.mjs';
import {summarizeLexisDashboard} from '../lib/lexis-dashboard-metrics.mjs';
import {todayBrazil} from '../lib/tarefas.mjs';
import {resolveCompanyAccess} from '../lib/lexis-shared-portfolio.mjs';
import LexisAttendanceBoard from './lexis-attendance-board';
import {useLexisAttendanceAudit} from './use-lexis-attendance-audit';
const n=v=>v==null?'—':Number(v).toLocaleString('pt-BR');
const date=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
const labels={prazo:'Prazo',retorno:'Retorno',tarefa:'Tarefa',audiencia:'Audiência'};
function Stat({name,value,description,to,Icon,warning}){
 return <Link href={to} className={'lxd-stat '+(warning?'lxd-stat-danger':'')}><span className="lxd-stat-icon"><Icon size={19}/></span><span className="lxd-stat-name">{name}</span><strong>{value===null?'—':n(value)}</strong><small>{description}</small></Link>
}
function Head({eyebrow,title,to,children}){
 return <div className="lxd-heading"><div><span>{eyebrow}</span><h2>{title}</h2>{children&&<p>{children}</p>}</div>{to&&<Link href={to}>Ver detalhes <ArrowRight size={14}/></Link>}</div>
}
export default function LexisDashboard({db,session}){
 const [version,setVersion]=useState(0),[homeView,setHomeView]=useState('rotina');
 const [companyId,setCompanyId]=useState('');
 const audit=useLexisAttendanceAudit(db,companyId,session.user.id);
 const [state,setState]=useState({loading:true,error:'',company:'',warnings:[],valid:{},stats:null});
 const refresh=useCallback(()=>setVersion(v=>v+1),[]);
 useEffect(()=>{
  let mounted=true;
  (async()=>{
   setState(old=>({...old,loading:true,error:''}));
   try{
    const {data,error}=await db.from('usuarios').select('id,auth_user_id,empresa_id,nome').eq('auth_user_id',session.user.id).limit(2);
    if(error)throw error;
    const profile=resolveCompanyAccess(data||[],session.user.id);
    if(!profile)throw new Error('Sem vínculo único com uma empresa autorizada no LexisPredict.');
    if(mounted)setCompanyId(profile.empresa_id);
    const [company,loaded]=await Promise.all([
     db.from('empresas').select('nome').eq('id',profile.empresa_id).maybeSingle(),
     loadLexisCompanySources(db,profile.empresa_id)
    ]);
    if(!Object.values(loaded.valid).some(Boolean))throw new Error('Fontes indisponíveis: '+loaded.errors.join(' · '));
    const stats=summarizeLexisDashboard({...loaded.sources,today:todayBrazil(),valid:loaded.valid});
    if(mounted)setState({loading:false,error:'',stats,company:company.data?.nome||'Organização',warnings:loaded.errors,valid:loaded.valid});
   }catch(err){if(mounted)setState(old=>({...old,loading:false,error:String(err.message||err),stats:null}))}
  })();
  return()=>{mounted=false};
 },[db,session.user.id,version]);
 const s=state.stats,valid=state.valid;
 const maxTribunal=Math.max(1,...(s?.tribunals||[]).map(x=>x.count));
 const maxMonth=Math.max(1,...(s?.months||[]).map(x=>x.count));
 return <main className="lxd-shell" data-lexis-dashboard="executive">
  <header className="lxd-top workbench-home-hero"><div><small>ESCRITÓRIO / VISÃO GERAL</small><h1>Seu dia de trabalho</h1><p>{state.company||'Carteira da empresa'}</p><div className="workbench-home-date"><CalendarDays size={16}/>{new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long',timeZone:'America/Sao_Paulo'}).format(new Date())}</div></div><div className="workbench-home-numbers"><Link href="/processos"><span>Processos ativos</span><strong>{s?n(s.active):'—'}</strong></Link><Link href="/tarefas?tipo=retorno&status=hoje"><span>Retornos de hoje</span><strong>{s?n(s.returnsToday):'—'}</strong></Link><Link href="/vencidos"><span>Tarefas vencidas</span><strong>{s?n(s.overdueTasks):'—'}</strong></Link></div><div className="lxd-actions"><button className="inf-btn" disabled={state.loading} onClick={()=>{refresh();audit.refresh()}}><RefreshCw size={15}/>{state.loading?' Consultando...':' Atualizar'}</button><Link className="inf-btn primary" href="/processos"><Scale size={15}/> Abrir carteira</Link></div></header>
  {state.loading&&<p className="lxd-message" role="status">Conferindo todos os registros da empresa, incluindo páginas adicionais...</p>}
  {state.error&&<div className="lxd-message danger" role="alert"><AlertTriangle size={18}/><span>Falha na consulta do Lexis: {state.error}. Não exibimos totais presumidos.</span><button className="inf-btn" onClick={refresh}>Repetir consulta</button></div>}
  {state.warnings.length>0&&<p className="lxd-message" role="alert">Algumas fontes não responderam: {state.warnings.join(' · ')}. Indicadores dessas fontes aparecem indisponíveis.</p>}
  <nav className="workbench-home-nav" aria-label="Visões do painel">{[['rotina','Minha rotina',ClipboardList],['carteira','Panorama da carteira',BarChart3],['historico','Atendimentos registrados',Users]].map(([id,label,Icon])=><button type="button" key={id} aria-pressed={homeView===id} onClick={()=>setHomeView(id)}><Icon size={17}/>{label}</button>)}</nav>
  <div hidden={homeView!=='rotina'} className="inf-home-command-grid"><div className="inf-home-focus">{s?<section className="inf-priority-board" aria-label="Prioridades do dia">
   <div className="inf-priority-lead"><small>PAINEL DE TRABALHO</small><h2>Por onde começar?</h2><p>Abra uma das filas abaixo para agir sobre as pendências reais da sua organização.</p><Link href="/vencidos" className="inf-btn primary">Ver todas as pendências <ArrowRight size={16}/></Link></div>
   <div className="inf-priority-actions">{[{label:'Retornos atrasados',value:s.overdueReturns,to:'/tarefas?tipo=retorno&status=vencido',Icon:Clock3,level:'danger',hint:'Clientes aguardando atualização'},{label:'Retornos hoje',value:s.returnsToday,to:'/tarefas?tipo=retorno&status=hoje',Icon:Users,level:'today',hint:'Contatos programados para hoje'},{label:'Tarefas atrasadas',value:s.overdueTasks,to:'/vencidos',Icon:FileWarning,level:'danger',hint:'Atividades ainda não concluídas'},{label:'Próximos compromissos',value:s.upcoming7,to:'/agenda',Icon:CalendarDays,level:'normal',hint:'Calendário dos próximos sete dias'}].map(({label,value,to,Icon,level,hint})=><Link href={to} key={label} data-priority={level}><span className="inf-priority-icon"><Icon size={20}/></span><span className="inf-priority-caption"><strong>{label}</strong><small>{hint}</small></span><b>{n(value)}</b><ArrowRight size={16}/></Link>)}</div>
  </section>:<section className="inf-home-await"><h2>Prioridades da organização</h2><p>{state.loading?'Carregando as pendências reais...':'Atualize para consultar a carteira.'}</p></section>}</div><section className="inf-quick-start" aria-label="Ações rápidas"><h2>O que você precisa fazer?</h2><div className="inf-quick-grid">{[{to:"/processos",Icon:Scale,title:"Consultar processo",detail:"Andamentos, clientes e atendimentos"},{to:"/tarefas?status=hoje",Icon:ClipboardList,title:"Organizar o dia",detail:"Tarefas e retornos"},{to:"/agenda",Icon:CalendarDays,title:"Ver agenda",detail:"Prazos e compromissos"},{to:"/pecas",Icon:FileText,title:"Preparar uma peça",detail:"Minutas vinculadas ao processo"}].map(({to,Icon,title,detail})=><Link key={to} href={to}><Icon size={21}/><span><strong>{title}</strong><small>{detail}</small></span><ArrowRight size={16}/></Link>)}</div></section></div>
  {s&&<><section hidden={homeView!=='carteira'} className="lxd-stats" aria-label="Indicadores da carteira">
   <Stat name="Processos com CNJ" value={s.processes} description="Somente processos com número CNJ" to="/processos" Icon={Scale}/>
   <Stat name="Processos ativos com CNJ" value={s.active} description="Desconsidera encerrados" to="/processos" Icon={Activity}/>
   <Stat name="Compromissos judiciais futuros" value={valid.hearings?s.hearingsFuture:null} description="Com data, não canceladas" to="/audiencias" Icon={Gavel}/>
   <Stat name="Menções a verificar" value={valid.hearings?s.hearingsUndated:null} description="Fora da agenda até confirmação" to="/audiencias" Icon={CalendarDays}/>
  </section>
  <section hidden={homeView==='historico'} className="lxd-panels">
   <article hidden={homeView!=='rotina'} className="lxd-panel"><Head eyebrow="ACOMPANHAMENTO AO CLIENTE" title="Retornos e atendimentos" to="/tarefas?tipo=retorno">Regra dos retornos: próximo retorno comparado com o último atendimento do cliente.</Head>
    <div className="lxd-overdue"><span>Retornos vencidos (com CNJ)</span><strong>{n(s.overdueReturns)}</strong></div>
    <div className="lxd-lines">
     <Link href="/tarefas?tipo=retorno&status=hoje">Para hoje <b>{n(s.returnsToday)}</b><ArrowRight size={14}/></Link>
     <Link href="/tarefas?tipo=retorno&status=proximos">Nos próximos 7 dias <b>{n(s.returnsNext7)}</b><ArrowRight size={14}/></Link>
     <Link href="/tarefas?tipo=retorno&status=atendimentos_hoje">Já atendidos hoje · auditoria <b>{audit.data?n(audit.data.todayTotal):audit.loading?'…':'—'}</b><ArrowRight size={14}/></Link>
     <Link href="/tarefas?tipo=retorno&status=meus_atendimentos">Meus atendimentos hoje <b>{audit.data?n(audit.data.personalToday):audit.loading?'…':'—'}</b><ArrowRight size={14}/></Link>
     <Link href="/tarefas?tipo=retorno&status=atendido">Agendamentos concluídos por data <b>{n(s.returnsAttended)}</b><ArrowRight size={14}/></Link>
     <Link href="/tarefas?tipo=retorno">Agendamentos em processos ativos <b>{n(s.returnsScheduled)}</b><ArrowRight size={14}/></Link>
    </div>
    <p className="lxd-subtle">Atendimentos auditados por operador são contabilizados pela consulta Lexis de auditoria, separados dos retornos concluídos por comparação de datas. Datas legadas de proximo_prazo não são consideradas vencidas.</p>
   </article>
   <article hidden={homeView!=='rotina'} className="lxd-panel"><Head eyebrow="PRÓXIMOS COMPROMISSOS" title="Agenda da organização" to="/agenda">{s.upcoming7==null?"Total indisponível: parte das fontes não respondeu. Lista parcial abaixo.":n(s.upcoming7)+" compromissos datados nos próximos sete dias, incluindo hoje."}</Head>
    {s.upcoming.length?s.upcoming.slice(0,6).map(x=><Link className="lxd-row" href={x.kind==='audiencia'?'/audiencias':x.kind==='prazo'?'/agenda?tipo=prazo':'/agenda'} key={x.id}><time>{date(x.due_on)}</time><span><strong>{x.title}</strong><small>{labels[x.kind]} · {x.responsible||'Sem responsável'}</small></span><ArrowRight size={14}/></Link>):<p className="lxd-subtle">{s.upcoming7==null?"Nenhum compromisso nas fontes disponíveis.":"Nenhum compromisso datado."}</p>}
   </article>
   <article hidden={homeView!=='carteira'} className="lxd-panel"><Head eyebrow="PANORAMA" title="Situação dos processos" to="/processos">Distribuição da carteira por situação interna.</Head>
    {valid.processes?<><div className="lxd-rail"><i style={{width:(100*s.active/Math.max(1,s.processes))+'%'}}/></div><div className="lxd-pair"><span>Em andamento <strong>{n(s.active)}</strong></span><span>Encerrados ou arquivados <strong>{n(s.closed)}</strong></span></div>
    <p className="lxd-subtle"><CheckCircle2 size={15}/> {n(s.excludedNoCnj)} registros sem número CNJ de 20 dígitos foram excluídos dos indicadores.</p></>:<p className="lxd-subtle">Carteira indisponível nesta consulta.</p>}
   </article>
   <article hidden={homeView!=='carteira'} className="lxd-panel"><Head eyebrow="AUDIÊNCIAS MONITORADAS" title="Conferência de pautas" to="/audiencias">Menções não confirmadas ficam fora da agenda. Sessões e notificações são distinguidas na aba Audiências.</Head>
    {valid.hearings?<><div className="lxd-hearings">{[['Com data',s.hearingsTotal],['Futuras',s.hearingsFuture],['Passadas',s.hearingsPast],['Menções a verificar',s.hearingsUndated]].map(([label,value])=><div key={label}><strong>{n(value)}</strong><span>{label}</span></div>)}</div><p className="lxd-subtle">{n(s.hearingsCanceled)} canceladas ou suspensas; verificar realização das passadas nos autos.</p></>:<p className="lxd-subtle">Dados de audiências indisponíveis.</p>}
   </article>
   <article hidden={homeView!=='carteira'} className="lxd-panel"><Head eyebrow="DISTRIBUIÇÃO" title="Tribunais da carteira" to="/processos">Processos em andamento por tribunal informado.</Head>
    {!valid.processes&&<p className="lxd-subtle">Distribuição indisponível nesta consulta.</p>}
    <div className="lxd-bars">{s.tribunals.map(x=><div key={x.label}><div><span title={x.label}>{x.label}</span><b>{n(x.count)}</b></div><progress value={x.count} max={maxTribunal}/></div>)}</div>
   </article>
   <article hidden={homeView!=='carteira'} className="lxd-panel"><Head eyebrow="EVOLUÇÃO" title="Cadastros dos últimos meses" to="/relatorios">Processos cadastrados, não andamentos judiciais.</Head>
    {!valid.processes&&<p className="lxd-subtle">Histórico indisponível nesta consulta.</p>}
    <div className="lxd-months">{s.months.map(x=><div key={x.month}><b>{n(x.count)}</b><div><i style={{height:(100*x.count/maxMonth)+'%'}}/></div><small>{x.month.slice(5)}/{x.month.slice(2,4)}</small></div>)}</div>
   </article>
  </section><section hidden={homeView!=='historico'} className="workbench-attendance-history">{companyId&&<LexisAttendanceBoard audit={audit} userId={session.user.id} />}</section><p className="lxd-bottom"><BarChart3 size={15}/> Dados filtrados pelo vínculo de empresa do usuário no Supabase W1 Capital. Sempre confira prazos e audiências em documento judicial oficial.</p></>}
 </main>;
}
