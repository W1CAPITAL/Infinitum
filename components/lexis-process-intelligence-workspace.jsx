'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import ProgressiveListEnd from './progressive-list-end';
import MonthlyNotices,{downloadNoticesXlsx} from './infinitum-monthly-notices';
import {publicationDay,brazilDay} from '../lib/infinitum-monthly-notices.mjs';
import {Activity,AlertTriangle,ArrowRight,BookOpen,CheckCircle2,Clock3,Download,ExternalLink,FileSearch,Filter,PauseCircle,RefreshCw,Search,ShieldCheck,Users} from 'lucide-react';
import {
 loadLexisProcessIntelligence,classifyFasesProvas,sortTriageRows,formatFasesDate,
 exportFasesCsv,listProcessosParados,exportParadosCsv,loadHandledParados,saveHandledParado,clearHandledParado,matchFiltrosFase,PARADOS_BANDS
} from '../lib/lexis-process-intelligence.mjs';

const number=value=>value==null?'—':Number(value).toLocaleString('pt-BR');
const safe=v=>String(v||'');
function Panel({children,className=''}){return <section className={'lxp-panel '+className}>{children}</section>}
function Stat({label,value,description,icon:Icon}){return <article className="lxp-stat"><span><Icon size={17}/>{label}</span><strong>{number(value)}</strong><small>{description}</small></article>}
function StatusTag({children,tone='neutral'}){return <span className={'lxp-tag lxp-tag-'+tone}>{children}</span>}
function DownloadButton({onClick,disabled,children}){return <button type="button" className="lxp-button" onClick={onClick} disabled={disabled}><Download size={15}/>{children}</button>}
function CaseLink({cnj}){return cnj?<Link className="lxp-link" href={'/processos?buscar='+encodeURIComponent(cnj)}>Abrir processo <ArrowRight size={13}/></Link>:<span className="lxp-muted">Sem número CNJ</span>}
function exportDownload(text,name){
 const blob=new Blob([text],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function FasesWorkspace({cases,loading,error,refresh,stale,onBack}){
 const available=!loading&&!error||stale;
 const [query,setQuery]=useState(''),[type,setType]=useState('todos'),[source,setSource]=useState('todos'),[category,setCategory]=useState('todos'),[priority,setPriority]=useState('todos'),[limit,setLimit]=useState(60);
 const moreRows=useCallback(()=>setLimit(n=>n+60),[]);
 const all=useMemo(()=>sortTriageRows(classifyFasesProvas(cases)),[cases]);
 const rows=useMemo(()=>all.filter(r=>(type==='todos'||r.tipo===type)&&(source==='todos'||r.nivel===source)&&(category==='todos'||r.categoria===category)&&(priority==='todos'||r.prioridade===priority)&&(!query.trim()||[r.cliente,r.cnj,r.advogado,r.fase,r.acao,r.evidencia,r.escritorio].join(' ').toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')))),[all,type,source,category,priority,query]);
 const counts=useMemo(()=>({replica:all.filter(x=>x.tipo==='replica').length,provas:all.filter(x=>x.tipo==='provas').length,official:all.filter(x=>x.nivel==='tribunal').length,high:all.filter(x=>x.prioridade==='alta').length}),[all]);
 const download=()=>downloadNoticesXlsx(rows.map(r=>({client:r.cliente,cnj:r.cnj,date:publicationDay(r.dataMovimento),phase:r.fase,summary:r.evidencia,action:r.acao,deadline:'Conferir publicação',lawyer:r.advogado,link:r.fonte.startsWith('DJEN')?r.linkDjen:''})),'fases-provas-'+brazilDay());
 return <main className="lxp-shell" data-lexis-fases-provas>
  <header className="lxp-hero"><div><small>INFINITUM · INTELIGÊNCIA PROCESSUAL</small><h1>Réplica, provas e perícias</h1><button className="lxp-button" onClick={onBack}>Voltar às intimações do mês</button><p>Localize referências a réplicas, provas, documentos e perícias na carteira inteira. Cada ocorrência mostra se veio do último registro DataJud/DJEN ou de uma anotação interna.</p></div><ShieldCheck size={30}/></header>
  <div className="lxp-stats">
   <Stat icon={BookOpen} label="Ocorrências" value={available?all.length:null} description="Referências encontradas na carteira"/>
   <Stat icon={FileSearch} label="Réplica" value={available?counts.replica:null} description="Registros relacionados à contestação"/>
   <Stat icon={Activity} label="Provas e perícias" value={available?counts.provas:null} description="Documentos e especificação de provas"/>
   <Stat icon={CheckCircle2} label="Último ato oficial" value={available?counts.official:null} description="DataJud/DJEN armazenado"/>
   <Stat icon={AlertTriangle} label="Prioridade alta" value={available?counts.high:null} description="Exige leitura e validação humana"/>
  </div>
  <Panel>
   <div className="lxp-toolbar"><div><h2>Consulta da carteira</h2><p>{number(cases.length)} processos carregados de forma paginada</p></div><button className="lxp-button" onClick={refresh} disabled={loading}><RefreshCw size={15}/>Atualizar</button></div>
   {loading&&<p className="lxp-notice">Consultando todos os processos da empresa...</p>}
   {error&&<p className="lxp-error" role="alert">{error}</p>}
   {stale&&<p className="lxp-notice">A última consulta completa foi preservada; a atualização atual não foi concluída.</p>}
  </Panel>
  <Panel>
   <div className="lxp-toolbar"><div><h2>Filtrar e exportar</h2><p>{number(rows.length)} de {number(all.length)} ocorrências</p></div><DownloadButton onClick={download} disabled={!rows.length}>Baixar XLSX</DownloadButton></div>
   <div className="lxp-filters">
    <label className="lxp-search"><Search size={16}/><input value={query} onChange={e=>{setQuery(e.target.value);setLimit(60)}} placeholder="Buscar cliente, CNJ, advogado ou providência"/></label>
    <label>Etapa<select value={type} onChange={e=>{setType(e.target.value);setLimit(60)}}><option value="todos">Réplica e provas</option><option value="replica">Somente réplica</option><option value="provas">Somente provas</option></select></label>
    <label>Origem<select value={source} onChange={e=>{setSource(e.target.value);setLimit(60)}}><option value="todos">Todas</option><option value="tribunal">Último ato DataJud/DJEN</option><option value="cadastro">Registro interno</option><option value="mencao">Menção genérica</option></select></label>
    <label>Situação<select value={category} onChange={e=>{setCategory(e.target.value);setLimit(60)}}><option value="todos">Todas</option><option value="intimacao">Intimação / providência</option><option value="enviado">Envio / juntada</option><option value="pendencia">Pendência</option><option value="pericia">Perícia</option><option value="decisao">Decisão posterior</option><option value="referencia">Referência genérica</option></select></label>
    <label>Prioridade<select value={priority} onChange={e=>{setPriority(e.target.value);setLimit(60)}}><option value="todos">Todas</option><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></select></label>
   </div>
   <p className="lxp-muted lxp-disclaimer"><ShieldCheck size={14}/> A triagem não calcula prazo judicial, não confirma protocolo e não autoriza cobrança. “Enviado” em anotação interna não substitui comprovante de protocolo.</p>
  </Panel>
  {!loading&&!error&&!rows.length&&<Panel><p className="lxp-empty">Nenhuma ocorrência corresponde aos filtros. Isso não significa ausência de prazos ou de providências em outras fontes.</p></Panel>}
  <div className="lxp-cases">
   {rows.slice(0,limit).map(row=><article className="lxp-case" key={row.key}>
    <div className="lxp-case-head"><div><small>{row.tipo==='replica'?'RÉPLICA':'PROVAS / DOCUMENTOS'}</small><h3>{row.cliente}</h3><p className="lxp-cnj">{row.cnj||'CNJ não informado'}</p></div><StatusTag tone={row.prioridade}>{row.prioridade==='alta'?'Prioridade alta':row.prioridade==='media'?'Acompanhar':'Baixa prioridade'}</StatusTag></div>
    <div className="lxp-case-grid">
     <div><small>SITUAÇÃO IDENTIFICADA</small><strong>{row.fase}</strong><p>{row.motivo}</p></div>
     <div><small>EVIDÊNCIA</small><StatusTag tone={row.nivel==='tribunal'?'official':row.nivel==='cadastro'?'internal':'neutral'}>{row.nivel==='tribunal'?'Último ato consultado':row.nivel==='cadastro'?'Registro interno':'Menção genérica'}</StatusTag><p className="lxp-evidence">{row.evidencia||'Sem trecho disponível'}</p><p className="lxp-muted">{row.fonte} · {row.dataMovimento}</p><details><summary>Ver evidências completas</summary><p>Registro interno: {row.registroInterno||'Não encontrado'}</p><p>DataJud: {row.datajudUltimoNome||'Não encontrado'}</p><p>DJEN: {row.djenUltimoResumo||'Não encontrada'}</p>{row.linkDjen&&<a href={row.linkDjen} target="_blank" rel="noopener noreferrer">Abrir publicação DJEN <ExternalLink size={12}/></a>}</details></div>
     <div><small>PRÓXIMA AÇÃO SUGERIDA</small><strong>{row.acao}</strong><p>DataJud consultado: {row.datajud} · DJEN consultado: {row.djen}</p>{row.proximoRetorno&&<p>Retorno interno: {formatFasesDate(row.proximoRetorno)} (não é prazo judicial)</p>}</div>
    </div>
    <footer><span>{row.advogado} · {row.escritorio||row.tribunal||'Sem escritório'}</span><CaseLink cnj={row.cnj}/></footer>
   </article>)}
  </div>
  {rows.length>limit&&<ProgressiveListEnd shown={Math.min(limit,rows.length)} total={rows.length} onMore={moreRows} disabled={loading}/> }
 </main>;
}
function ParadosWorkspace({cases,companyId,userId,loading,error,refresh,stale}){
 const available=!loading&&!error||stale;
 const [minDays,setMinDays]=useState(15),[search,setSearch]=useState(''),[lawyer,setLawyer]=useState('ALL'),[state,setState]=useState('pendentes'),[phaseFilters,setPhaseFilters]=useState([]),[onlyPhone,setOnlyPhone]=useState(false),[limit,setLimit]=useState(50),[treated,setTreated]=useState({});
 const moreRows=useCallback(()=>setLimit(n=>n+50),[]);
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{if(companyId&&userId)setTreated(loadHandledParados({companyId,userId}))},[companyId,userId]);
 const base=useMemo(()=>listProcessosParados(cases,minDays,{includeSemScan:true,onlyConfirmados:false,now}),[cases,minDays,now]);
 const all=useMemo(()=>base.map(item=>({...item,tratado:!!treated[String(item.case.protocolo||'')]})),[base,treated]);
 const lawyers=useMemo(()=>[...new Set(cases.map(x=>safe(x.advogado)).filter(x=>x&&x!=='Não atribuído'))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[cases]);
 const rows=useMemo(()=>all.filter(item=>{
  const c=item.case,term=search.trim().toLocaleLowerCase('pt-BR');
  if(term&&![c.cliente,c.protocolo,c.advogado].some(v=>safe(v).toLocaleLowerCase('pt-BR').includes(term)))return false;
  if(lawyer!=='ALL'&&safe(c.advogado).toUpperCase()!==lawyer.toUpperCase())return false;
  if(onlyPhone&&safe(c.telefone).replace(/\D/g,'').length<10)return false;
  if(state==='confirmados'&&!['parado_confirmado','parado_provavel'].includes(item.estado))return false;
  if(state==='sem_scan'&&item.estado!=='sem_scan')return false;
  if(state==='tratados'&&!item.tratado)return false;
  if(state==='pendentes'&&item.tratado)return false;
  if(!matchFiltrosFase({temContestacao:item.temContestacao,temSentenca:item.temSentenca,temReplica:item.temReplica,cumprimentoRecebido:!!item.cumprimentoRecebido,cumprimentoAberto:!!item.cumprimentoAberto,replicaPendente:!!item.replicaPendente,temCitacao:false,temAudiencia:false},phaseFilters,item.diasParadoTribunal))return false;
  return true;
 }),[all,search,lawyer,onlyPhone,state,phaseFilters]);
 const kpis=useMemo(()=>({pending:all.filter(x=>!x.tratado).length,confirmed:all.filter(x=>x.estado==='parado_confirmado'&&!x.tratado).length,unscanned:all.filter(x=>x.estado==='sem_scan'&&!x.tratado).length,old:all.filter(x=>x.estado!=='sem_scan'&&x.diasParadoTribunal>=90&&!x.tratado).length,treated:all.filter(x=>x.tratado).length}),[all]);
 const togglePhase=value=>setPhaseFilters(old=>old.includes(value)?old.filter(x=>x!==value):[...old,value]);
 const mark=item=>{
  const cnj=String(item.case.protocolo||'').trim();if(!cnj)return;
  saveHandledParado(cnj,{companyId,userId,day:new Date().toISOString().slice(0,10)});
  setTreated(loadHandledParados({companyId,userId}));
 };
 const reopen=item=>{
  const cnj=String(item.case.protocolo||'').trim();if(!cnj)return;
  clearHandledParado(cnj,{companyId,userId});setTreated(loadHandledParados({companyId,userId}));
 };
 const download=()=>exportDownload(exportParadosCsv(rows),'infinitum-processos-parados-'+minDays+'d.csv');
 return <main className="lxp-shell" data-lexis-processos-parados>
  <header className="lxp-hero lxp-hero-stalled"><div><small>INFINITUM · GESTÃO DA CARTEIRA</small><h1>Processos parados com ação possível</h1><p>Identifique processos sem movimentação oficial recente, pendências de fase e oportunidades de impulso. A fila separa processos confirmados daqueles que ainda precisam de consulta DataJud/DJEN.</p></div><PauseCircle size={31}/></header>
  <div className="lxp-stats">
   <Stat icon={Activity} label="Fila pendente" value={available?kpis.pending:null} description="Processos ainda não tratados"/>
   <Stat icon={CheckCircle2} label="Parados confirmados" value={available?kpis.confirmed:null} description="Último movimento oficial registrado"/>
   <Stat icon={Search} label="Sem consulta oficial" value={available?kpis.unscanned:null} description="Precisa auditar DataJud + DJEN"/>
   <Stat icon={Clock3} label="90 dias ou mais" value={available?kpis.old:null} description="Sem sinal oficial recente"/>
   <Stat icon={Users} label="Tratados" value={available?kpis.treated:null} description="Marcados neste navegador e usuário"/>
  </div>
  <Panel>
   <div className="lxp-toolbar"><div><h2>Fila da empresa</h2><p>{number(cases.length)} processos consultados · ordenação por prioridade operacional</p></div><button className="lxp-button" onClick={()=>{setNow(new Date());refresh()}} disabled={loading}><RefreshCw size={15}/>Atualizar</button></div>
   {loading&&<p className="lxp-notice">Consultando a carteira completa...</p>}{error&&<p className="lxp-error" role="alert">{error}</p>}{stale&&<p className="lxp-notice">Exibindo a última consulta completa, preservada após falha na atualização.</p>}
  </Panel>
  <Panel>
   <div className="lxp-toolbar"><div><h2>Filtros operacionais</h2><p>{number(rows.length)} resultados</p></div><DownloadButton onClick={download} disabled={!rows.length}>Exportar CSV</DownloadButton></div>
   <div className="lxp-filters">
    <label className="lxp-search"><Search size={16}/><input value={search} onChange={e=>{setSearch(e.target.value);setLimit(50)}} placeholder="Buscar cliente, CNJ ou advogado"/></label>
    <label>Sem movimento há<select value={minDays} onChange={e=>{setMinDays(Number(e.target.value));setLimit(50)}}>{PARADOS_BANDS.map(x=><option key={x} value={x}>{x===0?'Todos os períodos':x+' dias ou mais'}</option>)}</select></label>
    <label>Responsável<select value={lawyer} onChange={e=>setLawyer(e.target.value)}><option value="ALL">Todos</option>{lawyers.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>Estado<select value={state} onChange={e=>{setState(e.target.value);setLimit(50)}}><option value="pendentes">Pendentes</option><option value="confirmados">Parados confirmados ou prováveis</option><option value="sem_scan">Sem consulta</option><option value="tratados">Tratados</option><option value="todos">Todos</option></select></label>
   </div>
   <div className="lxp-chip-row">
    {[['replica_pendente','Réplica pendente'],['cumprimento_aberto','Cumprimento aberto'],['sem_contestacao','Sem contestação'],['sem_sentenca','Sem sentença'],['sem_replica','Sem réplica'],['janela_recente','Janela recente (30 dias)']].map(([id,label])=><button key={id} type="button" className={'lxp-chip '+(phaseFilters.includes(id)?'selected':'')} aria-pressed={phaseFilters.includes(id)} onClick={()=>togglePhase(id)}>{label}</button>)}
    <label className="lxp-phone-filter"><input type="checkbox" checked={onlyPhone} onChange={e=>setOnlyPhone(e.target.checked)}/> Somente com telefone cadastrado</label>
   </div>
   <p className="lxp-muted lxp-disclaimer"><ShieldCheck size={14}/> “Tratado” é uma marcação local de organização da fila. Não altera o processo, não registra atendimento no Supabase e não envia mensagem ao cliente.</p>
  </Panel>
  {!loading&&!error&&!rows.length&&<Panel><p className="lxp-empty">Nenhum processo corresponde aos filtros atuais.</p></Panel>}
  <div className="lxp-cases">
   {rows.slice(0,limit).map(item=><article className="lxp-case lxp-stalled-case" key={String(item.case.id||item.case.protocolo)}>
    <div className="lxp-case-head"><div><small>{item.estado==='sem_scan'?'PRECISA DE CONSULTA OFICIAL':item.estado==='parado_confirmado'?'SEM MOVIMENTO OFICIAL':'SEM MOVIMENTO PROVÁVEL'}</small><h3>{item.case.cliente}</h3><p className="lxp-cnj">{item.case.protocolo||'CNJ não informado'}</p></div><div className="lxp-stalled-badges"><StatusTag tone={item.estado==='parado_confirmado'?'official':item.estado==='sem_scan'?'neutral':'internal'}>{item.estado==='parado_confirmado'?'Confirmado':item.estado==='sem_scan'?'Sem consulta':'Provável'}</StatusTag><StatusTag tone={item.scoreAcao>=180?'high':'neutral'}>Prioridade {number(item.scoreAcao)}</StatusTag></div></div>
    <div className="lxp-case-grid"><div><small>ÚLTIMO SINAL</small><strong>{item.ultimoSinalResumo}</strong><p>{item.fonteData} · {item.dataReferencia?formatFasesDate(item.dataReferencia):'Data não registrada'}</p><p>{item.estado==='sem_scan'?'Ainda não há sinal oficial de movimento no cadastro.':'Há '+number(item.diasParadoTribunal)+' dia(s) desde a última data oficial registrada.'}</p></div>
     <div><small>FASE E OPORTUNIDADES</small><div className="lxp-opportunities">{item.oportunidades.map((x,i)=><p key={i}><ArrowRight size={13}/>{x}</p>)}</div><p className="lxp-muted">Contestação: {item.temContestacao?'sim':'não'} · Réplica: {item.temReplica?'sim':'não'} · Sentença: {item.temSentenca?'sim':'não'}</p></div>
     <div><small>ACOMPANHAMENTO</small><strong>{item.case.advogado||'Não atribuído'}</strong><p>Último retorno da equipe: {item.diasSemRetornoEquipe==null?'Sem registro':number(item.diasSemRetornoEquipe)+' dia(s)'}</p><p>Telefone: {item.case.telefone||'Não cadastrado'}</p></div></div>
    <footer><CaseLink cnj={item.case.protocolo}/><div>{item.tratado?<button className="lxp-button" type="button" onClick={()=>reopen(item)}>Reabrir na fila</button>:<button className="lxp-button lxp-button-primary" type="button" onClick={()=>mark(item)} disabled={!item.case.protocolo}>Marcar tratado</button>}<Link className="lxp-link" href={item.case.protocolo?'/scanner?cnj='+encodeURIComponent(item.case.protocolo):'/scanner'}>Abrir Scanner <ExternalLink size={13}/></Link></div></footer>
   </article>)}
  </div>
  {rows.length>limit&&<ProgressiveListEnd shown={Math.min(limit,rows.length)} total={rows.length} onMore={moreRows} disabled={loading}/> }
 </main>;
}
export default function LexisProcessIntelligenceWorkspace({db,session,mode='fases'}){
 const [state,setState]=useState({loading:true,cases:[],companyId:'',error:'',stale:false});
 const [retry,setRetry]=useState(0);
 const [fasesView,setFasesView]=useState('recentes');
 const [loadedFor,setLoadedFor]=useState('');
 const refresh=()=>setRetry(x=>x+1);
 const load=useCallback(async()=>{
  if(!db||!session?.user?.id)return;
  setState(old=>loadedFor===session.user.id?({...old,loading:true,error:''}):({loading:true,cases:[],companyId:'',error:'',stale:false}));
  try{const result=await loadLexisProcessIntelligence(db,session.user.id,{pageSize:500,maxRows:20000});
   setLoadedFor(session.user.id);setState({loading:false,cases:result.cases,companyId:result.companyId,error:'',stale:false});
  }catch(e){setState(old=>({...old,loading:false,error:String(e?.message||e).slice(0,350),stale:old.cases.length>0}))}
 },[db,session?.user?.id,retry]);
 useEffect(()=>{void load()},[load]);
 const current=loadedFor===session?.user?.id?state:{...state,cases:[],companyId:'',stale:false,loading:!state.error};
 return mode==='parados'
  ?<ParadosWorkspace cases={current.cases} companyId={current.companyId} userId={session?.user?.id} loading={state.loading} error={state.error} refresh={refresh} stale={current.stale}/>
  :fasesView==='recentes'?<MonthlyNotices key={session?.user?.id} db={db} companyId={current.companyId} cases={current.cases} loading={current.loading} error={state.error} refresh={refresh} stale={current.stale} onBack={()=>setFasesView('fases')}/>:<FasesWorkspace cases={current.cases} loading={current.loading} error={state.error} refresh={refresh} stale={current.stale} onBack={()=>setFasesView('recentes')}/>;
}
