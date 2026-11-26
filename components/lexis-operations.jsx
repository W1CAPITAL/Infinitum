'use client';
import {Suspense,useCallback,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {Archive,CalendarDays,CheckCircle2,ChevronLeft,ChevronRight,Clock3,ExternalLink,FileText,Gavel,Plus,RefreshCw,Search,Users,X} from 'lucide-react';
import {groupWorkQueue} from '../lib/workspace-layout.mjs';
import {buildLexisEvents,filterAgendaEvents,classifyMonitoredHearing} from '../lib/lexis-operations.mjs';
import {calendarBounds,shiftCivilDay,hearingView,hearingCounts} from '../lib/infinitum-calendar.mjs';
import {summarizeLexisReturns} from '../lib/lexis-return-kpis.mjs';
import {filterLexisCompanyQueue,summarizeLexisCompanyQueue} from '../lib/lexis-company-queue.mjs';
import {loadLexisCompanySources} from '../lib/lexis-company-data.mjs';
import ProgressiveListEnd from './progressive-list-end';
import LexisEventDetails from './lexis-event-details';
import HearingClock from './infinitum-hearing-clock';
import {hearingClockLines} from '../lib/infinitum-hearing-clock.mjs';
import LexisAttendanceBoard from './lexis-attendance-board';
import {useLexisAttendanceAudit} from './use-lexis-attendance-audit';
const brazilToday=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
const iso=(year,month,day)=>new Date(Date.UTC(year,month,day)).toISOString().slice(0,10);
const fmt=d=>d?String(d).slice(0,10).split('-').reverse().join('/'):'Data não confirmada';
const kinds={retorno:'Retorno',prazo:'Prazo',audiencia:'Audiência',tarefa:'Tarefa'};
const statuses={vencido:'Vencido',atencao:'Atenção',em_dia:'Em dia',atendido:'Atendido',encerrado:'Encerrado',sem_data:'Sem data'};
function Chip({value,label}){return <span className={'lx-status lx-status--'+(statuses[value]?value:'sem_data')} data-status={value}>{label||statuses[value]||'Sem data'}</span>}
function Card({item,onSelect,onFinish,busy}){
 return <article className="lx-event-card">
  <div className="lx-event-symbol">{item.kind==='audiencia'?<Gavel size={18}/>:item.kind==='prazo'?<Clock3 size={18}/>:<CalendarDays size={18}/>}</div>
  <div className="lx-event-main"><small className="lx-event-kicker">{kinds[item.kind]||'Compromisso'} · {fmt(item.due_on)}{item.kind!=='audiencia'&&item.hour?' · '+item.hour:''}</small>
   {item.kind==='audiencia'&&<HearingClock clock={item.hearing_clock} endClock={item.hearing_end_clock} compact/>}
   <strong>{item.title}</strong>
   <span>{item.process_number||item.source||'Registro da empresa'}</span>
   <small>Responsável: {item.responsible||'Não informado'}</small>
  </div>
  <div className="lx-event-right"><Chip value={item.status} label={item.status_label}/>{onFinish&&(item.task_id||item.manual_id)&&!['encerrado','atendido'].includes(item.status)&&<button type="button" className="inf-btn" disabled={busy} onClick={()=>onFinish(item)}><CheckCircle2 size={15}/> Concluir</button>}<button className="lx-event-open" type="button" onClick={()=>onSelect(item)}>{item.kind==='retorno'?'Atender / detalhes':'Detalhes'} <ChevronRight size={14}/></button></div>
 </article>;
}
export default function LexisOperations(props){return <Suspense fallback={<main className="inf-studio"><p role="status">Carregando área de trabalho…</p></main>}><LexisOperationsInner {...props}/></Suspense>}
function LexisOperationsInner({db,session,area='deadlines'}){
 const urlQuery=useSearchParams().toString();
 const [profile,setProfile]=useState(null),[team,setTeam]=useState([]),[sourceRows,setSourceRows]=useState({processes:[],hearings:[],tasks:[],manual:[]});
 const audit=useLexisAttendanceAudit(db,profile?.empresa_id,session.user.id);
 const [errors,setErrors]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[search,setSearch]=useState('');
 const [month,setMonth]=useState(brazilToday().slice(0,7)),[filter,setFilter]=useState(area==='tasks'?'prioridades':area==='overdue'?'vencidos':'todos'),[showPast,setShowPast]=useState(false),[view,setView]=useState('month');
 const [anchor,setAnchor]=useState(brazilToday());
 const [validSources,setValidSources]=useState({processes:false,hearings:false,tasks:false,manual:false});
 const [deadlineMode,setDeadlineMode]=useState('juridicos');
 const [queueScope,setQueueScope]=useState('todos'),[density,setDensity]=useState('compacta');
 const [page,setPage]=useState(0),[kindFilter,setKindFilter]=useState('todos'),[responsibleFilter,setResponsibleFilter]=useState('todos'),[selectedDay,setSelectedDay]=useState('');
 useEffect(()=>{setPage(0)},[area,search,filter,month,showPast,view,kindFilter,responsibleFilter,selectedDay,deadlineMode,queueScope]);
 useEffect(()=>{if(area==='tasks')setFilter('prioridades');else if(area==='overdue')setFilter('vencidos')},[area]);
 useEffect(()=>{
  if(typeof window==='undefined')return;
  const params=new URLSearchParams(urlQuery),value=params.get('status'),kind=params.get('tipo');
  setKindFilter('todos');setQueueScope(params.get('escopo')==='carteira'?'carteira':'todos');setResponsibleFilter('todos');setSearch('');setSelectedDay('');
  setFilter(area==='tasks'?'prioridades':area==='overdue'?'vencidos':'todos');
  if(['agenda','tasks','overdue'].includes(area)&&Object.hasOwn(kinds,kind))setKindFilter(kind);
  if(area==='agenda'&&['hoje','proximos'].includes(value)){setView('list');setFilter(value);setMonth(brazilToday().slice(0,7));return}
  if(area==='agenda'&&kind==='prazo'){setView('list');setFilter('todos');return}
  if(area==='agenda'){setView('month');setAnchor(brazilToday());setMonth(brazilToday().slice(0,7));}
  if(['tasks','overdue'].includes(area)&&['atendimentos_hoje','meus_atendimentos','vencido','vencidos','hoje','proximos','atendido','retornos','agendados'].includes(value)){setFilter(value==='atendido'?'atendidos':value==='vencido'?'vencidos':value==='retornos'?'agendados':value);return}
  if(area==='tasks'&&kind==='retorno'){setFilter('todos');return}
  if(area!=='deadlines')return;
  if(['atendimentos_hoje','meus_atendimentos','vencido','vencidos','hoje','proximos'].includes(value))
   {setDeadlineMode('retornos');setFilter(value==='vencidos'?'vencido':value);}
 },[area,urlQuery]);
 const [selected,setSelected]=useState(null),[editing,setEditing]=useState(false),[form,setForm]=useState({title:'',due_on:brazilToday(),kind:'tarefa',priority:'normal',notes:'',responsible:''});
 const currentYear=Number(month.slice(0,4)),currentMonth=Number(month.slice(5,7))-1;
 const first=iso(currentYear,currentMonth,1),last=iso(currentYear,currentMonth+1,0);
 const calendar=calendarBounds(view==='week'||view==='day'?anchor:first,view);
 const rangeStart=view==='week'||view==='day'?calendar.start:first,rangeEnd=view==='week'||view==='day'?calendar.end:last;
 useEffect(()=>{
  let live=true;setLoading(true);
  (async()=>{
   try{
    const {data,error}=await db.from('usuarios').select('id,auth_user_id,empresa_id,nome').eq('auth_user_id',session.user.id).limit(2);
    if(error||data?.length!==1||!data[0].empresa_id)throw Error(error?.message||'Seu login não possui vínculo único com uma organização do LexisPredict.');
    const my=data[0];
    const all=await db.from('usuarios').select('id,auth_user_id,empresa_id,nome').eq('empresa_id',my.empresa_id).limit(250);
    if(all.error)throw Error(all.error.message);
    if(!live)return;
    setProfile(my);setTeam((all.data||[]).filter(x=>x.empresa_id===my.empresa_id));
    setForm(old=>({...old,responsible:my.nome||''}));
   }catch(err){if(live){setErrors(['Acesso bloqueado: '+err.message]);setLoading(false)}}
  })();
  return()=>{live=false};
 },[db,session.user.id]);
 const load=useCallback(async()=>{
  if(!profile?.empresa_id)return;
  setLoading(true);setErrors([]);setValidSources({processes:false,hearings:false,tasks:false,manual:false});
  try{
   const loaded=await loadLexisCompanySources(db,profile.empresa_id);
   if(loaded.errors.length===4)throw new Error('Todas as fontes falharam: '+loaded.errors.join(' · '));
   setSourceRows(loaded.sources);setErrors(loaded.errors);setValidSources(loaded.valid);
  }catch(err){setErrors(['A consulta não foi concluída: '+(err.message||String(err))]);}
  finally{setLoading(false);}
 },[db,profile?.empresa_id]);
 useEffect(()=>{load()},[load]);
 const items=useMemo(()=>buildLexisEvents({...sourceRows,members:team,today:brazilToday()}),[sourceRows,team]);
 const queueItems=useMemo(()=>items.filter(x=>x.kind!=='audiencia'),[items]);
 const queueSummary=useMemo(()=>summarizeLexisCompanyQueue(queueItems,brazilToday(),{kind:kindFilter,scope:queueScope,responsible:responsibleFilter,query:search}),[queueItems,kindFilter,queueScope,responsibleFilter,search]);
 const queueSourcesAvailable=queueScope==='carteira'?validSources.processes:kindFilter==='tarefa'?validSources.tasks&&validSources.manual:kindFilter==='prazo'?validSources.manual:kindFilter==='retorno'?validSources.processes&&validSources.manual:validSources.processes&&validSources.tasks&&validSources.manual;
 const areaRows=useMemo(()=>{
  let filtered=items;
  if(area==='tasks'||area==='overdue')filtered=queueItems;
  if(area==='audiencias')filtered=filtered.filter(x=>x.kind==='audiencia');
  if(area==='deadlines')filtered=deadlineMode==='juridicos'?filtered.filter(x=>x.kind==='prazo'&&x.manual_id):filtered.filter(x=>x.kind==='retorno'&&x.process_id!=null&&x.status!=='encerrado');
  if(area==='agenda'){const allDeadlines=kindFilter==='prazo'&&view==='list'&&!selectedDay;filtered=filterAgendaEvents(filtered,{today:brazilToday(),start:allDeadlines||selectedDay||['hoje','proximos','sem_data'].includes(filter)?undefined:rangeStart,end:allDeadlines||selectedDay||['hoje','proximos','sem_data'].includes(filter)?undefined:rangeEnd,filter,kind:kindFilter,selectedDay,responsible:responsibleFilter});}
  if(area!=='agenda'&&kindFilter!=='todos')filtered=filtered.filter(x=>x.kind===kindFilter);
  if(area!=='agenda'&&responsibleFilter!=='todos')filtered=filtered.filter(x=>x.responsible===responsibleFilter);
  if(area==='audiencias'&&!showPast&&filter==='todos')filtered=filtered.filter(x=>hearingView(x,'futuras',brazilToday())||(!x.due_on&&x.manual_id));
  if(search.trim()&&area!=='tasks'&&area!=='overdue'){const term=search.toLocaleLowerCase('pt-BR').trim();
    filtered=filtered.filter(x=>[x.title,x.client_name,x.process_number,x.responsible,x.notes].some(z=>String(z||'').toLocaleLowerCase('pt-BR').includes(term)))}
  return filtered;
 },[items,queueItems,area,search,showPast,rangeStart,rangeEnd,filter,kindFilter,selectedDay,responsibleFilter,deadlineMode,view]);
 const listing=useMemo(()=>{
  if(area==='agenda')return areaRows;
  if(area==='tasks'||area==='overdue')return filterLexisCompanyQueue(areaRows,{view:filter,today:brazilToday(),query:search,scope:queueScope});
  return areaRows.filter(x=>{
   if(filter==='todos')return true;
   if(area==='audiencias')return hearingView(x,filter,brazilToday());
   if(area==='deadlines'&&deadlineMode==='juridicos')return filterAgendaEvents([x],{today:brazilToday(),filter}).length===1;
   if(x.kind!=='retorno'||!x.process_id||x.status==='encerrado')return false;
   if(filter==='retornos')return true;
   if(filter==='hoje')return x.due_on===brazilToday()&&x.status!=='atendido'&&x.status!=='encerrado';
   if(filter==='proximos'){
    const end=new Date(brazilToday()+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+7);
    return x.due_on>=brazilToday()&&x.due_on<=end.toISOString().slice(0,10)&&x.status!=='atendido'&&x.status!=='encerrado';
   }
   return x.status===filter;
  });
 },[areaRows,filter,area,search,deadlineMode,queueScope]);
 const returnKpis=useMemo(()=>summarizeLexisReturns(sourceRows.processes,brazilToday()),[sourceRows.processes]);
 const responsibleOptions=useMemo(()=>[...new Set(items.map(x=>x.responsible).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[items]);
 const allHearings=useMemo(()=>items.filter(x=>x.kind==='audiencia'),[items]);
 const hearingBase=allHearings.filter(x=>(responsibleFilter==='todos'||x.responsible===responsibleFilter)&&(!search.trim()||[x.title,x.client_name,x.process_number,x.responsible,x.notes].some(z=>String(z||'').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR').trim()))));
 const hc=hearingCounts(hearingBase,brazilToday());
 const hearingMetrics=[['Agendadas',hc.agendadas,'agendadas'],['Compromissos futuros',hc.futuras,'futuras'],['Notificações a verificar',hc.informadas,'informadas'],['Sessões de julgamento',hc.sessoes,'sessoes'],['Passadas a conferir',hc.vencido,'vencido'],['Realizadas',hc.realizadas,'realizadas'],['Canceladas / encerradas',hc.canceladas,'canceladas'],['Cadastros manuais',hc.manuais,'manuais']];
 const queueMetrics=[
  ['Pendências abertas',queueSummary.abertas,'prioridades'],
  ['Vencidos',queueSummary.vencidos,'vencidos'],
  ['Para hoje',queueSummary.hoje,'hoje'],
  ['Em dia',queueSummary.em_dia,'em_dia'],
  ['Sem data',queueSummary.sem_data,'sem_data'],
  ['Concluídos',queueSummary.finalizados+queueSummary.atendidos,'finalizados']
 ];
 const agendaMetrics=[['Compromissos no período',filterAgendaEvents(items,{today:brazilToday(),start:rangeStart,end:rangeEnd,kind:kindFilter,responsible:responsibleFilter}).length,'todos'],['Para hoje',filterAgendaEvents(items,{today:brazilToday(),filter:'hoje',kind:kindFilter,responsible:responsibleFilter}).length,'hoje'],['Próximos 7 dias',filterAgendaEvents(items,{today:brazilToday(),filter:'proximos',kind:kindFilter,responsible:responsibleFilter}).length,'proximos'],['Sem data',filterAgendaEvents(items,{today:brazilToday(),filter:'sem_data',kind:kindFilter,responsible:responsibleFilter}).length,'sem_data']];
 const legalDeadlines=items.filter(x=>x.kind==='prazo'&&x.manual_id);
 const legalMetrics=[['Prazos cadastrados',legalDeadlines.length,'todos'],['Vencidos',legalDeadlines.filter(x=>x.status==='vencido').length,'vencido'],['Hoje',filterAgendaEvents(legalDeadlines,{today:brazilToday(),filter:'hoje'}).length,'hoje'],['Próximos 7 dias',filterAgendaEvents(legalDeadlines,{today:brazilToday(),filter:'proximos'}).length,'proximos'],['Concluídos',legalDeadlines.filter(x=>x.status==='encerrado').length,'encerrado']];
 const displayedMetrics=(area==='deadlines'&&deadlineMode==='juridicos')||(area==='agenda'&&kindFilter==='prazo'&&view==='list')?legalMetrics:area==='agenda'?agendaMetrics:area==='tasks'||area==='overdue'?queueMetrics:area==='audiencias'?hearingMetrics:[
  ['Retornos agendados',returnKpis.scheduled,'retornos'],
  ['Retornos vencidos',returnKpis.overdue,'vencido'],
  ['Retornos hoje',returnKpis.today,'hoje'],
  ['Próximos 7 dias',returnKpis.next7,'proximos'],
  ['Já atendidos hoje',audit.data?.todayTotal??null,'atendimentos_hoje'],
  ['Meus atendimentos hoje',audit.data?.personalToday??null,'meus_atendimentos']
 ];
 function chooseFilter(value){if(area==='audiencias'&&['vencido','encerrado','realizadas','canceladas','manuais'].includes(value))setShowPast(true);if(area==='agenda'){setSelectedDay('');if(value!=='todos'||kindFilter==='prazo')setView('list');if(['hoje','proximos'].includes(value))setMonth(brazilToday().slice(0,7));}setFilter(value)}
 const save=async e=>{
  e.preventDefault();if(busy||!profile?.empresa_id)return;
  if(form.title.trim().length<3||form.title.length>250){setErrors(['O compromisso precisa ter título de 3 a 250 caracteres.']);return}
  setBusy(true);setErrors([]);
  try{
   const {data,error}=await db.from('office_deadlines').insert({
    owner_id:session.user.id,empresa_id:profile.empresa_id,title:form.title.trim(),due_on:form.due_on,kind:form.kind,
    priority:form.priority,status:'aberto',responsible:form.responsible||profile.nome,notes:form.notes.trim()||null
   }).select('id').maybeSingle();
   if(error||!data?.id)throw Error(error?.message||'O banco não confirmou o compromisso.');
   setEditing(false);setForm({title:'',due_on:brazilToday(),kind:'tarefa',priority:'normal',notes:'',responsible:profile.nome||''});await load();
  }catch(err){setErrors(['Compromisso não registrado: '+err.message])}finally{setBusy(false)}
 };
 const finish=async x=>{
  if((!x.manual_id&&!x.task_id)||busy)return;setBusy(true);
  try{
   const result=x.task_id
    ?await db.from('crm_tarefas').update({feito:true,updated_at:new Date().toISOString()})
      .eq('id',x.task_id).eq('empresa_id',profile.empresa_id).select('id').maybeSingle()
    :await db.from('office_deadlines').update({status:'concluido',completed_at:new Date().toISOString()})
      .eq('id',x.manual_id).eq('empresa_id',profile.empresa_id).select('id').maybeSingle();
   if(result.error||!result.data?.id)throw Error(result.error?.message||'O banco não confirmou a conclusão.');
   setSelected(null);await load();
  }catch(err){setErrors(['Não foi possível concluir: '+err.message])}finally{setBusy(false)}
 };
 const reopen=async x=>{
  if(!profile?.empresa_id||busy||(!x.task_id&&!x.manual_id))return;
  setBusy(true);setErrors([]);
  try{
   const result=x.task_id?await db.from('crm_tarefas').update({feito:false,updated_at:new Date().toISOString()}).eq('id',x.task_id).eq('empresa_id',profile.empresa_id).select('id').maybeSingle():await db.from('office_deadlines').update({status:'aberto',completed_at:null,updated_at:new Date().toISOString()}).eq('id',x.manual_id).eq('empresa_id',profile.empresa_id).select('id').maybeSingle();
   if(result.error||!result.data?.id)throw Error(result.error?.message||'O banco não confirmou a reabertura.');
   setSelected(null);await load();
  }catch(err){setErrors(['Não foi possível reabrir: '+err.message])}finally{setBusy(false)}
 };
 const openDetails=event=>setSelected(event);
 const gotoMonth=delta=>{setSelectedDay('');if(view==='week'||view==='day'){const next=shiftCivilDay(anchor,delta*(view==='week'?7:1));setAnchor(next);setMonth(next.slice(0,7))}else setMonth(iso(currentYear,currentMonth+delta,1).slice(0,7))};
 const offset=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7;
 const grid=calendar.days;
 const groups=useMemo(()=>{const g=new Map();for(const x of listing){if(!x.due_on)continue;g.set(x.due_on,[...(g.get(x.due_on)||[]),x])}return g},[listing]);
 const PAGE_SIZE=60;
 const pageRows=listing.slice(0,(page+1)*PAGE_SIZE);
 const moreRows=useCallback(()=>setPage(p=>p+1),[]);
 const subtitles={agenda:'Compromissos e audiências da organização, em uma única visão.',deadlines:'Prazos jurídicos cadastrados separados de retornos ao cliente.',audiencias:'Audiências registradas pelo LexisPredict e suas fontes.',tasks:'Tarefas, retornos e compromissos de toda a organização.',overdue:'Pendências vencidas por padrão; os demais filtros permitem consultar toda a fila da empresa.'};
 const titles={agenda:'Agenda e prazos',deadlines:'Prazos e retornos',audiencias:'Audiências',tasks:'Tarefas da organização',overdue:'Vencidos'};
 if(!profile&&!loading)return <main className="inf-studio lx-workspace"><p role="alert" className="inf-note error">{errors[0]||'Acesso não autorizado.'}</p></main>;
 return <main className="inf-studio lx-workspace" data-lexis-operation={area}>
  <header className="inf-heading lx-workspace-heading"><div><small>INFINITUM / INTELIGÊNCIA JURÍDICA</small><h1>{titles[area]||'Agenda operacional'}</h1>
   <p>{subtitles[area]||subtitles.agenda}</p></div>
   <div className="inf-actions"><button className="inf-btn" type="button" onClick={()=>{load();audit.refresh()}} disabled={loading}><RefreshCw size={15}/> Atualizar</button>
    {area==='deadlines'?<Link className="inf-btn primary" href="/agenda"><Plus size={15}/> Novo compromisso na Agenda</Link>:area==='tasks'?<><Link className="inf-btn" href="/vencidos">Ver vencidos</Link><button className="inf-btn primary" type="button" onClick={()=>setEditing(x=>!x)}><Plus size={15}/> Nova tarefa</button></>:area==='overdue'?<Link className="inf-btn primary" href="/tarefas">Todas as tarefas</Link>:<button className="inf-btn primary" type="button" onClick={()=>{setForm(old=>({...old,kind:kindFilter==='prazo'?'prazo':old.kind}));setEditing(x=>!x)}}><Plus size={15}/> Novo compromisso</button>}</div>
  </header>
  {errors.map((e,i)=><p key={i} className="inf-note error" role="status">{e}</p>)}
  {loading&&<p className="inf-note">Consultando registros da organização no Supabase do LexisPredict...</p>}
  {area==='deadlines'&&<div className="lx-toolbar"><button type="button" className="inf-btn" aria-pressed={deadlineMode==='juridicos'} onClick={()=>{setDeadlineMode('juridicos');setFilter('todos')}}>Prazos jurídicos cadastrados</button><button type="button" className="inf-btn" aria-pressed={deadlineMode==='retornos'} onClick={()=>{setDeadlineMode('retornos');setFilter('todos')}}>Retornos de clientes</button></div>}
  <div className="inf-operation-desk">{['tasks','overdue'].includes(area)&&<nav className="workbench-operation-nav" aria-label="Fila de trabalho">{[['prioridades','Prioridades'],['vencidos','Vencidos'],['hoje','Hoje'],['proximos','Próximos 7 dias'],['finalizados','Finalizados'],['todos','Todos']].map(([id,label])=><button key={id} type="button" aria-pressed={filter===id} onClick={()=>chooseFilter(id)}>{label}</button>)}</nav>}<div className="lx-kpis">
   {displayedMetrics.map(([label,value,status])=>{
    const byAudit=status==='atendimentos_hoje'||status==='meus_atendimentos';
    const available=byAudit?!!audit.data:area==='audiencias'?validSources.hearings&&validSources.manual:area==='deadlines'&&deadlineMode==='juridicos'?validSources.manual:area==='agenda'?(kindFilter==='prazo'?validSources.manual:Object.values(validSources).every(Boolean)):(area==='tasks'||area==='overdue')?queueSourcesAvailable:validSources.processes;
    const pending=byAudit?audit.loading:loading;
    return <button key={status} type="button" className={'lx-kpi '+(filter===status?'is-active':'')}
     onClick={()=>chooseFilter(status)} aria-pressed={filter===status}>
     <span>{label}</span><strong>{!available?(pending?'…':'—'):Number(value).toLocaleString('pt-BR')}</strong>
     <span className={'lx-kpi-mark lx-kpi-mark--'+status}/></button>;
   })}
  </div>
  {area!=='audiencias'&&!(area==='deadlines'&&deadlineMode==='juridicos')&&<details className="inf-audit-disclosure" open={['atendimentos_hoje','meus_atendimentos'].includes(filter)}><summary>Histórico e auditoria de atendimentos</summary><LexisAttendanceBoard audit={audit} userId={session.user.id} compact={area==='agenda'}/></details>}
  <section className="pr-module lx-panel inf-operation-surface">
   <div className="pr-module-intro"><span>CARTEIRA DA ORGANIZAÇÃO</span><h2>{area==='audiencias'?'Compromissos judiciais.':area==='agenda'?'Calendário compartilhado.':area==='tasks'?'Fila empresarial de tarefas e retornos.':area==='overdue'?'Pendências vencidas da organização.':'Controle de vencimentos.'}</h2>
    <p>{area==='audiencias'?'Horário local do tribunal e horário de Brasília lado a lado. Confira o fuso indicado na intimação.':area==='agenda'?'Selecione um dia ou alterne para a lista de compromissos.':area==='overdue'?'Priorize as pendências vencidas. Abra o registro para atender ou conclua uma tarefa realizada.':'Organize as pendências por situação. Abra os detalhes para editar ou registrar atendimento.'}</p></div>
   <div className="lx-toolbar inf-operation-controls"><label className="lx-search"><Search size={16}/><input aria-label="Buscar nos compromissos" placeholder="Buscar cliente, processo ou responsável" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <select aria-label="Situação" value={filter} onChange={e=>chooseFilter(e.target.value)}>
      {area==='deadlines'&&deadlineMode==='juridicos'?<><option value="todos">Todos os prazos</option><option value="hoje">Hoje</option><option value="proximos">Próximos 7 dias</option><option value="vencido">Vencidos</option><option value="atencao">Atenção</option><option value="em_dia">Em dia</option><option value="encerrado">Concluídos</option></>:area==='agenda'?<><option value="todos">Todas as situações</option><option value="hoje">Hoje</option><option value="proximos">Próximos 7 dias</option>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</>:area==='tasks'||area==='overdue'?<><option value="prioridades">Prioridades</option><option value="vencidos">Somente vencidos</option><option value="hoje">Para hoje</option><option value="proximos">Próximos 7 dias</option><option value="em_dia">Em dia</option><option value="sem_data">Sem data</option><option value="finalizados">Finalizados</option><option value="atendidos">Retornos atendidos</option><option value="agendados">Agendamentos da carteira</option><option value="atendimentos_hoje">Atendimentos de hoje · auditoria</option><option value="meus_atendimentos">Meus atendimentos · auditoria</option><option value="todos">Todos os registros</option></>:<><option value="todos">Todas as situações</option>{area==='audiencias'?<><option value="futuras">Futuras</option><option value="agendadas">Audiências agendadas</option><option value="informadas">Notificações a verificar</option><option value="sessoes">Sessões de julgamento</option><option value="realizadas">Realizadas</option><option value="canceladas">Canceladas / encerradas</option><option value="manuais">Cadastros manuais</option>{Object.entries(statuses).filter(([k])=>!['atendido','sem_data'].includes(k)).map(([k,v])=><option key={k} value={k}>{k==='vencido'?'Passadas':v}</option>)}</>:<><option value="retornos">Retornos agendados</option><option value="hoje">Para hoje</option><option value="proximos">Próximos 7 dias</option><option value="atendimentos_hoje">Já atendidos hoje · auditoria</option><option value="meus_atendimentos">Meus atendimentos hoje · auditoria</option><option value="atendido">Agendamentos concluídos por data</option>{Object.entries(statuses).filter(([k])=>!['atendido','encerrado'].includes(k)).map(([k,v])=><option key={k} value={k}>{v}</option>)}</>}</>}
     </select>
    {['tasks','overdue'].includes(area)&&<select aria-label="Origem dos registros" value={queueScope} onChange={e=>{setQueueScope(e.target.value);if(e.target.value==='carteira')setKindFilter('retorno')}}><option value="todos">Todas as origens</option><option value="carteira">Retornos da carteira</option></select>}
    {['agenda','tasks','overdue'].includes(area)&&<select aria-label="Tipo de compromisso" value={kindFilter} onChange={e=>{setKindFilter(e.target.value);if(e.target.value!=='retorno')setQueueScope('todos')}}><option value="todos">Todos os tipos</option>{Object.entries(kinds).filter(([k])=>area==='agenda'||k!=='audiencia').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>}
    <select aria-label="Responsável" value={responsibleFilter} onChange={e=>setResponsibleFilter(e.target.value)}><option value="todos">Todos os responsáveis</option>{responsibleOptions.map(name=><option key={name} value={name}>{name}</option>)}</select>
    {area==='audiencias'&&<label className="lx-check"><input type="checkbox" checked={showPast} onChange={e=>setShowPast(e.target.checked)}/> Incluir audiências anteriores</label>}
    {area==='agenda'&&<div className="lx-view-toggle" role="group" aria-label="Visualização da agenda">{[['day','Dia'],['week','Semana'],['month','Mês'],['list','Lista']].map(([id,label])=><button key={id} className="inf-btn" type="button" onClick={()=>{setSelectedDay('');setFilter('todos');if(id==='day'||id==='week')setAnchor(month===brazilToday().slice(0,7)?brazilToday():first);setView(id)}} aria-pressed={view===id}>{label}</button>)}</div>}
   </div>
   {['tasks','overdue'].includes(area)&&<div className="inf-queue-result-bar"><div><strong>{loading?'Consultando…':listing.length.toLocaleString('pt-BR')+' registros'}</strong><small>{queueScope==='carteira'?'Somente retornos de processos ativos com CNJ':'Fila da organização · filtros aplicados'}</small></div><div role="group" aria-label="Densidade da lista"><button type="button" aria-pressed={density==='compacta'} onClick={()=>setDensity('compacta')}>Compacta</button><button type="button" aria-pressed={density==='confortavel'} onClick={()=>setDensity('confortavel')}>Confortável</button><button type="button" onClick={()=>{setSearch('');setResponsibleFilter('todos');setKindFilter('todos');setQueueScope('todos');setFilter(area==='overdue'?'vencidos':'prioridades')}}>Limpar filtros</button></div></div>}
   {area==='agenda'&&<div className="lx-calendar-header"><button className="inf-btn" aria-label="Período anterior" onClick={()=>gotoMonth(-1)}><ChevronLeft size={18}/></button>
    <strong>{view==='day'?fmt(anchor):view==='week'?fmt(calendar.start)+' – '+fmt(calendar.end):new Date(first+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC',month:'long',year:'numeric'})}</strong>
    <button className="inf-btn" aria-label="Próximo período" onClick={()=>gotoMonth(1)}><ChevronRight size={18}/></button>
    <button className="inf-btn" onClick={()=>{setSelectedDay('');setAnchor(brazilToday());setMonth(brazilToday().slice(0,7))}}>Hoje</button></div>}
   {area==='agenda'&&['month','week'].includes(view)&&<div className="lx-calendar-grid" data-calendar-view={view}>
    {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=><div key={d} className="lx-calendar-weekday">{d}</div>)}
    {grid.map(d=><div key={d} className={'lx-calendar-day '+(d.slice(0,7)!==month?'is-outside':'')+(d===brazilToday()?' is-today':'')}>
     <button type="button" className="inf-calendar-day-number" aria-label={'Abrir dia '+fmt(d)} onClick={()=>{setAnchor(d);setMonth(d.slice(0,7));setSelectedDay('');setView('day')}}>{Number(d.slice(8))}</button>{(groups.get(d)||[]).slice(0,3).map(e=><button key={e.id} type="button" title={e.kind==='audiencia'?e.title+' · '+hearingClockLines(e.hearing_clock).local+' · '+hearingClockLines(e.hearing_clock).brasilia:e.title} onClick={()=>openDetails(e)} className={'lx-calendar-entry lx-calendar-entry--'+e.status}>{e.kind==='audiencia'&&e.hearing_clock?.brasilia?e.hearing_clock.brasilia.time+' BSB · ':''}{e.title}</button>)}
     {(groups.get(d)||[]).length>3&&<button type="button" className="inf-btn" onClick={()=>{setSelectedDay(d);setView('list')}}>+{groups.get(d).length-3} registros</button>}
    </div>)}
   </div>}
   {area==='agenda'&&selectedDay&&<div className="lx-toolbar"><strong>{fmt(selectedDay)} · {listing.length} registros</strong><button type="button" className="inf-btn" onClick={()=>setSelectedDay('')}>Ver todos os dias</button></div>}
   {['atendimentos_hoje','meus_atendimentos'].includes(filter)&&area!=='audiencias'?<p className="inf-note" role="status">Os processos atendidos são contabilizados na auditoria por executor e data, conforme o quadro acima. A lista de retornos mostra agendamentos e não representa os atendimentos registrados.</p>:(area!=='agenda'||view==='list'||view==='day')&&<div className="lx-event-list inf-queue-list" data-density={density}>{(area==='tasks'||area==='overdue')?groupWorkQueue(pageRows,brazilToday()).map(group=><section className="inf-queue-section" key={group.key} data-queue={group.key}><header><div><h3>{group.label}</h3><small>{group.detail}</small></div><span>{group.items.length.toLocaleString('pt-BR')}</span></header>{group.items.map(x=><Card key={x.id} item={x} onSelect={openDetails} onFinish={finish} busy={busy}/>)}</section>):pageRows.map(x=><Card key={x.id} item={x} onSelect={openDetails}/>)}
     {listing.length>PAGE_SIZE&&<ProgressiveListEnd shown={pageRows.length} total={listing.length} onMore={moreRows} disabled={loading}/>}
    {!loading&&!listing.length&&<p className="pr-list-empty">Nenhum registro corresponde aos filtros. Confira as fontes e altere o período quando necessário.</p>}
   </div>}
   {area==='audiencias'&&<p className="inf-note">Audiências sem data e simples menções não entram no calendário. {validSources.hearings?sourceRows.hearings.filter(h=>classifyMonitoredHearing(h)==='pendente').length+' registros pendentes de confirmação foram excluídos da agenda. ':''}Notificações não verificadas e sessões de julgamento são identificadas separadamente. Marque "Incluir audiências anteriores" para consultar o histórico.</p>}
   {area==='deadlines'&&deadlineMode==='juridicos'&&<p className="inf-note">Prazos lançados na Agenda. Não são calculados automaticamente a partir de intimações; datas legadas não são tratadas como prazo judicial confirmado.</p>}
   {area==='deadlines'&&deadlineMode==='retornos'&&<p className="inf-note">Regra do LexisPredict: retorno vencido = próximo retorno anterior a hoje, sem atendimento na data combinada ou posterior, em processo ativo com CNJ. Datas antigas de proximo_prazo e compromissos manuais não são contabilizados. Confira tarefas manuais na Agenda.</p>}
  </section></div>
  {selected&&<LexisEventDetails key={selected.id} event={selected} db={db} profile={profile} onClose={()=>setSelected(null)} onSaved={async()=>{setSelected(null);await load()}} onFinish={finish} onReopen={reopen} team={team} busy={busy}/>}
  {editing&&<section className="pr-module lx-detail"><div className="lx-detail-head"><div><small>CADASTRO OPERACIONAL</small><h2>Novo compromisso</h2></div><button className="inf-btn" onClick={()=>setEditing(false)}><X size={14}/> Cancelar</button></div>
   <p>O compromisso será salvo para a organização, sem alterar movimentos oficiais do tribunal.</p>
   <form onSubmit={save} className="lx-form">
    <label>Título<input required minLength={3} maxLength={250} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
    <label>Data<input type="date" required value={form.due_on} onChange={e=>setForm({...form,due_on:e.target.value})}/></label>
    <label>Tipo<select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})}><option value="tarefa">Tarefa</option><option value="retorno">Retorno</option><option value="prazo">Prazo manual</option><option value="audiencia">Audiência manual (não verificada)</option></select></label>
    <label>Prioridade<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
    <label>Responsável<select value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}>{team.filter(m=>m.nome).map(m=><option key={m.id} value={m.nome}>{m.nome}</option>)}</select></label>
    <label className="lx-form-full">Observações<textarea maxLength={1500} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
    <button className="inf-btn primary" type="submit" disabled={busy}>Salvar compromisso da empresa</button>
   </form>
  </section>}
 </main>;
}
