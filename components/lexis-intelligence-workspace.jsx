'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {Activity,AlertTriangle,BarChart3,BriefcaseBusiness,CalendarClock,CheckCircle2,Download,FileText,Printer,RefreshCw,ShieldCheck,Users} from 'lucide-react';
import InfinitumExecutiveReport from './infinitum-executive-report';
import {buildReportSections} from '../lib/infinitum-report-executive.mjs';
import '../app/infinitum-executive-report.css';
import {buildExecutivePdf} from '../lib/executive-pdf.mjs';
import {TeamReport} from './lexis-team-report';
import '../app/lexis-report-complete-theme.css';
import {LEXIS_PERIODS,loadLexisIntelligence,summarizeLexisSnapshots,toLexisIntelligenceCsv} from '../lib/lexis-intelligence.mjs';

const number=value=>value==null?'—':Number(value).toLocaleString('pt-BR');
const day=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.slice(8,10)+'/'+value.slice(5,7):value||'—';
function Stat({icon:Icon,title,value,description,to,alert=false}){
 return <Link className={'lxd-stat'+(alert?' lxd-stat-danger':'')} href={to}>
  <span className="lxd-stat-icon"><Icon size={20}/></span>
  <span className="lxd-stat-name">{title}</span>
  <strong>{number(value)}</strong><small>{description}</small>
 </Link>;
}
function Ranked({title,description,rows}){
 const max=Math.max(1,...(rows||[]).map(x=>x.count||0));
 return <article className="lxd-panel">
  <div className="lxd-heading"><div><span>COMPOSIÇÃO DA CARTEIRA ATUAL</span><h2>{title}</h2><p>{description}</p></div></div>
  {!rows?.length?<p className="lxd-subtle">Esta fonte não forneceu uma distribuição confirmada.</p>:
   <div className="lxd-bars">{rows.map((x,i)=><div key={x.label+i}>
    <div><span title={x.label}>{x.label}</span><b>{number(x.count)}</b></div>
    <progress max={max} value={x.count} aria-label={x.label}/>
   </div>)}</div>}
 </article>;
}
function Trend({days}){
 const max=Math.max(1,...days.map(x=>x.count||0));
 return <article className="lxd-panel" id="evolucao">
  <div className="lxd-heading"><div><span>HISTÓRICO REGISTRADO · PERÍODO SELECIONADO</span><h2>Ritmo de atendimento</h2><p>Atendimentos por dia, registrados pelo executor. Não são estimativas nem total de processos atribuídos.</p></div></div>
  {!days.length?<p className="lxd-subtle">Histórico indisponível nesta consulta; não exibimos uma série inventada.</p>:
   <div className="lxi-trend" aria-label="Atendimentos diários">{days.map(x=><div className="lxi-day" key={x.day}>
    <strong>{number(x.count)}</strong><div className="lxi-track"><div className="lxi-bar" style={{height:(100*(x.count||0)/max)+'%'}}/></div>
    <small>{day(x.day)}</small></div>)}</div>}
 </article>;
}
function AnalysisPanel({analysis}){
 if(!analysis)return <article className="lxd-panel"><h2>Auditorias e trabalho analítico</h2><p className="lxd-subtle">Indicadores analíticos indisponíveis nesta consulta.</p></article>;
 const metrics=[['Registros analíticos',analysis.totalRegistros],['Processos analisados',analysis.processosAnalisados],['Processos com trabalho',analysis.processosComTrabalho],['Trabalho interno no período',analysis.atendidosInternamenteNoPeriodo],['Auditoria sistêmica',analysis.auditoriaSistemica],['Auditoria documental',analysis.auditoriaDocumental],['Triagem de réplica e provas',analysis.triagemReplicaProvas],['Dossiês individuais',analysis.dossiesIndividuais],['Investigações',analysis.investigacoesExternas],['Projetos',analysis.projetos],['Tarefas concluídas · histórico',analysis.tarefasConcluidas],['Tarefas concluídas · período',analysis.tarefasConcluidasPeriodo],['Contatos declarados · período',analysis.contatosDeclaradosPeriodo]];
 return <section className="lxd-panel" aria-label="Auditorias e trabalho analítico">
  <div className="lxd-heading"><div><span>SUPERVISÃO · REGISTROS REAIS</span><h2>Auditorias, análises e tarefas</h2><p>Registros históricos e do período, separados de atendimentos ao cliente.</p></div></div>
  <div className="lxi-productivity">{metrics.map(([label,value])=><div key={label}><span>{label}</span><strong>{number(value)}</strong></div>)}</div>
  <h3>Tarefas registradas por responsável</h3>
  {analysis.tarefasPorPessoa.length?<div className="lxd-lines">{analysis.tarefasPorPessoa.map((row,i)=><div key={row.nome+'-'+i}><strong>{row.nome}</strong><p>Histórico: {number(row.total)} · Período: {number(row.periodo)}</p></div>)}</div>:<p className="lxd-subtle">Sem detalhamento de responsáveis nesta consulta.</p>}
 </section>;
}
export default function LexisIntelligenceWorkspace({db,session,mode='report'}){
 const [period,setPeriod]=useState('mes'),[version,setVersion]=useState(0);
 const [state,setState]=useState({loading:true,data:null,error:''});
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  if(!db||!session?.user?.id)return;
  let active=true;
  setState({loading:true,data:null,error:''});
  loadLexisIntelligence(db,session.user.id,{period,area:mode}).then(data=>{
   if(active)setState({loading:false,data,error:''});
  }).catch(e=>{if(active)setState({loading:false,data:null,error:String(e?.message||e).slice(0,350)})});
  return()=>{active=false};
 },[db,session?.user?.id,period,mode,version]);
 const result=state.data;
 const model=useMemo(()=>result?summarizeLexisSnapshots(result):null,[result]);
 const h=model?.headline;
 const sections=useMemo(()=>buildReportSections(result?.report||{}),[result]);
 const exportCsv=()=>{
  if(!model)return;
  const bytes=toLexisIntelligenceCsv(model,period);
  const url=URL.createObjectURL(new Blob([bytes],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='infinitum-'+mode+'-'+period+'.csv';a.click();URL.revokeObjectURL(url);
  setNotice('Relatório CSV gerado a partir dos dados consultados.');
 };
 function exportPdf(){
  if(!model||state.loading)return;
  try{
   const bytes=buildExecutivePdf(model,{sections,period:LEXIS_PERIODS.find(p=>p.id===period)?.label||period,mode,warnings:result?.warnings||[]});
   const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
   const a=document.createElement('a');a.href=url;a.download='INFINITUM-'+mode+'-'+period+'.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   setNotice('Arquivo PDF gerado com os dados consultados.');
  }catch(error){setNotice('Não foi possível gerar o PDF: '+String(error?.message||error));}
 }
 const title=mode==='supervision'?'Supervisão':'Relatórios executivos';
 return <main className="lxd-shell lxi-shell" data-lexis-intelligence={mode}>
  <header className="lxd-top lxi-header"><div>
   <small>INFINITUM · GESTÃO JURÍDICA</small><h1>{title}</h1>
   <p>Acompanhe resultados, produtividade e evolução do período. Exporte os dados disponíveis ao seu perfil.</p>
  </div><div className="lxd-actions lxi-actions">
   <label className="lxi-period" htmlFor={'lxi-period-'+mode}>Período
    <select id={'lxi-period-'+mode} value={period} disabled={state.loading} onChange={e=>{setPeriod(e.target.value);setNotice('')}}>
     {LEXIS_PERIODS.map(p=><option value={p.id} key={p.id}>{p.label}</option>)}
    </select>
   </label>
   <button type="button" className="inf-btn" disabled={state.loading} onClick={()=>setVersion(x=>x+1)}><RefreshCw size={15}/> Atualizar</button>
   <button type="button" className="inf-btn" disabled={!model||state.loading} onClick={exportCsv}><Download size={15}/> Exportar CSV</button>
   <button type="button" className="inf-btn primary" disabled={!model||state.loading} onClick={exportPdf}><Download size={15}/> Baixar PDF</button>
  </div></header>
  <nav className="lxi-links" aria-label="Áreas de gestão"><Link href="/supervisao" aria-current={mode==='supervision'?'page':undefined}><ShieldCheck size={15}/> Supervisão</Link><Link href="/report" aria-current={mode==='report'?'page':undefined}><BarChart3 size={15}/> Relatórios</Link><Link href="/tarefas"><CalendarClock size={15}/> Tarefas</Link><Link href="/vencidos"><AlertTriangle size={15}/> Vencidos</Link></nav>
  {state.loading&&<p className="lxd-message" role="status">Consultando os indicadores reais do período no Supabase...</p>}
  {state.error&&<div className="lxd-message danger" role="alert"><AlertTriangle size={18}/><span>Não foi possível consultar: {state.error}. Nenhum KPI foi substituído por estimativa.</span><button type="button" className="inf-btn" onClick={()=>setVersion(x=>x+1)}>Tentar novamente</button></div>}
  {result?.warnings?.length>0&&<p role="alert" className="lxd-message">Algumas fontes não responderam: {result.warnings.join(' · ')}. Os respectivos indicadores permanecem indisponíveis.</p>}
  {notice&&<p role="status" className="lxd-message">{notice}</p>}
  {model&&<>
   {mode==='report'&&<InfinitumExecutiveReport key={period} report={result.report} model={model} sections={sections} periodLabel={LEXIS_PERIODS.find(p=>p.id===period)?.label||period}/>}
   {mode==='supervision'&&<>
   <section aria-label="KPIs da carteira e dos atendimentos" className="lxd-stats">
    <Stat icon={BriefcaseBusiness} title="Carteira disponível" value={h.total} description="Processos visíveis conforme permissões" to="/processos"/>
    <Stat icon={Activity} title="Ativos" value={h.ativos} description="Situação atual, não resultado do período" to="/processos"/>
    <Stat icon={CheckCircle2} title="Encerrados" value={h.encerrados} description="Status no CRM, não mérito judicial" to="/encerrados"/>
    <Stat icon={AlertTriangle} title="Retornos vencidos" value={h.vencidos} description="Somente vencimentos confirmados" to="/vencidos" alert/>
    <Stat icon={Users} title="Atendimentos registrados" value={h.atendimentos} description="Eventos identificados no período selecionado" to="/tarefas"/>
    <Stat icon={CalendarClock} title="Processos atendidos" value={h.processosAtendidos} description="Processos distintos no histórico do período" to="/tarefas"/>
    <Stat icon={FileText} title="Atividades registradas no período" value={h.atividades} description="Trabalho cadastrado no período, separado dos atendimentos" to="/atividades"/>
    <Stat icon={FileText} title="Atividades · histórico completo" value={h.atividadesHistorico} description="Registros efetivamente salvos, todas as datas" to="/atividades"/>
    <Stat icon={RefreshCw} title="Novidades na carteira" value={h.novidades} description="Sinais identificados na carteira atual" to="/processos"/>
    <Stat icon={AlertTriangle} title="Sem retorno registrado" value={h.semRetorno} description="Pendências de acompanhamento, conforme fonte" to="/tarefas" alert/>
    {mode==='supervision'&&<Stat icon={Activity} title="Edições auditadas" value={h.edicoes} description="Eventos de alteração registrados pela auditoria" to="/supervisao"/>}
   </section>
   <section className="lxd-panels" aria-label="Gráficos e distribuição">
    <Trend days={model.timeline}/>
    <article className="lxd-panel"><div className="lxd-heading"><div><span>FONTE: HISTÓRICO DA EMPRESA</span><h2>Produtividade</h2><p>Atendimentos, atividades e edição são eventos diferentes; não somar como clientes atendidos.</p></div></div>
     <div className="lxi-productivity">
      <div><span>Atendimentos no período</span><strong>{number(h.atendimentos)}</strong></div>
      <div><span>Atividades registradas</span><strong>{number(h.atividades)}</strong></div>
      <div><span>Edições auditadas</span><strong>{number(h.edicoes)}</strong></div>
      <div><span>Colaboradores detalhados</span><strong>{result?.report?.equipe?.pessoas?number(model.team.length):'—'}</strong></div>
     </div>
     <p className="lxd-subtle">Carteira atribuída não demonstra trabalho realizado. Só contabilizamos eventos registrados.</p>
    </article>
    {mode==='supervision'&&<>
     <Ranked title="Situações do cadastro" description="Classificação da carteira atual." rows={model.statuses}/>
     <Ranked title="Tribunais" description="Distribuição conforme tribunal registrado." rows={model.tribunals}/>
    </>}
   </section>
   <AnalysisPanel analysis={model.analysis}/></>}
   {result?.report?.equipe?.pessoas&&<section id="equipe" className="lxi-team report-completo-shell" aria-label="Produtividade por colaborador">
    <TeamReport data={result.report.equipe} currentUserId={session.user.id}/>
   </section>}
   {!result?.report?.equipe?.pessoas&&<p className="lxd-message">Detalhamento por colaborador indisponível para esta consulta ou perfil.</p>}
   <footer className="lxi-footnote"><ShieldCheck size={15}/> Indicadores consultados sob o acesso autenticado da empresa. Sem resultados presumidos. O histórico por período não deve ser confundido com o tamanho atual da carteira. {model.source.consultadoEm&&<span>Consulta: {new Date(model.source.consultadoEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</span>}</footer>
  </>}
 </main>;
}
