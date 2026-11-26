'use client';
import {useEffect,useMemo,useState} from 'react';
import {Download,ExternalLink,RefreshCw,Search,ShieldCheck} from 'lucide-react';
import Link from 'next/link';
import ProgressiveListEnd from './progressive-list-end';
import {brazilDay,monthlyNotices,loadMonthlyDjenHistory,publicationDay} from '../lib/infinitum-monthly-notices.mjs';
import {buildNoticesXlsx} from '../lib/infinitum-notices-xlsx.mjs';
import {classifyFasesProvas,sortTriageRows} from '../lib/lexis-process-intelligence.mjs';
import {phaseReportRows} from '../lib/infinitum-phase-report.mjs';
export function downloadNoticesXlsx(rows,label,options){
 const blob=new Blob([buildNoticesXlsx(rows,options)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='infinitum-'+label+'.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const dateLabel=s=>String(s||'').split('-').reverse().join('/');
export default function MonthlyNotices({db,companyId,cases,loading,error,stale,refresh,onBack}){
 const [month,setMonth]=useState(()=>brazilDay().slice(0,7)),[query,setQuery]=useState(''),[limit,setLimit]=useState(60);
 const [history,setHistory]=useState({rows:[],loading:true,error:'',key:''});
 const key=companyId+'|'+month;
 useEffect(()=>{if(!db||!companyId||loading)return;let live=true;setHistory({rows:[],loading:true,error:'',key});loadMonthlyDjenHistory(db,companyId,month).then(rows=>{if(live)setHistory({rows,loading:false,error:'',key})}).catch(e=>{if(live)setHistory({rows:[],loading:false,error:String(e.message||e),key})});return()=>{live=false}},[db,companyId,month,loading,key]);
 const ready=history.key===key&&!history.loading,available=!loading&&!error||stale;
 const fullReport=useMemo(()=>phaseReportRows(sortTriageRows(classifyFasesProvas(cases))),[cases]);
 const all=useMemo(()=>monthlyNotices(cases,ready?history.rows:[],month),[cases,ready,history.rows,month]);
 const rows=useMemo(()=>all.filter(n=>[n.client,n.cnj,n.lawyer,n.phase,n.summary].join(' ').toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))),[all,query]);
 return <main className="lxp-shell" data-lexis-fases-provas><header className="lxp-hero"><div><small>INFINITUM · INTELIGÊNCIA PROCESSUAL</small><h1>Fases, provas e intimações</h1><p>Intimações do mês, com resumo, providência e publicação oficial.</p></div><ShieldCheck size={30}/></header>
 <section className="lxp-panel"><div className="lxp-toolbar"><div><h2>Intimações recentes</h2><p>{available?all.length+' registros localizados':'Consultando carteira'} · {cases.length} processos da carteira</p></div><button className="lxp-button" onClick={refresh} disabled={loading}><RefreshCw size={15}/>Atualizar dados</button></div>
 <div className="lxp-filters"><button className="lxp-button lxp-button-primary" onClick={()=>{setMonth(brazilDay().slice(0,7));setLimit(60)}}>Mês atual</button><label>Mês da publicação<input type="month" value={month} max={brazilDay().slice(0,7)} onChange={e=>{if(e.target.value){setMonth(e.target.value);setLimit(60)}}}/></label><button className="lxp-button" onClick={onBack}>Ver carteira de réplica e provas</button><button className="lxp-button" disabled={!available||loading||!fullReport.length} onClick={()=>downloadNoticesXlsx(fullReport,'replicas-e-provas-'+brazilDay(),{kind:'phases'})}><Download size={15}/>Baixar XLSX completo ({fullReport.length})</button></div>
 {loading&&<p className="lxp-notice">Carregando carteira da empresa…</p>}{error&&<p className="lxp-error" role="alert">{error}</p>}{stale&&<p className="lxp-notice">Exibindo carteira da última consulta concluída.</p>}
 {!ready&&companyId?<p className="lxp-notice">Carregando histórico DJEN…</p>:ready&&history.error?<p className="lxp-error" role="alert">{history.error}. Exibindo apenas últimas publicações cadastradas; lista parcial.</p>:<p className="lxp-muted">Base: histórico DJEN armazenado e últimas publicações cadastradas. Não é nova consulta ao tribunal; ausência de registro não significa ausência de intimação.</p>}</section>
 <section className="lxp-panel"><div className="lxp-toolbar"><div><h2>Publicações do período</h2><p>{rows.length} resultados · mais recentes primeiro</p></div><button className="lxp-button" type="button" disabled={!available||!ready||!rows.length} onClick={()=>downloadNoticesXlsx(rows,'intimacoes-'+month+(history.error?'-parcial':''))}><Download size={15}/>Baixar XLSX de intimações do mês</button></div><label className="lxp-search"><Search size={16}/><input value={query} onChange={e=>{setQuery(e.target.value);setLimit(60)}} placeholder="Buscar cliente, processo, assunto ou advogado"/></label></section>
 {available&&ready&&!rows.length&&<section className="lxp-panel"><p className="lxp-empty">Nenhuma intimação localizada nos registros disponíveis para este mês. Consulte o Scanner para atualizar as fontes oficiais.</p></section>}
 <div className="lxp-cases">{rows.slice(0,limit).map(row=><article className="lxp-case" key={row.key}><div className="lxp-case-head"><div><small>{dateLabel(row.date)} · {row.phase}</small><h3>{row.client}</h3><p className="lxp-cnj">{row.cnj}</p></div><span className="lxp-tag lxp-tag-official">DJEN</span></div><div className="lxp-case-grid"><div><small>RESUMO</small><p>{row.summary}</p></div><div><small>PROVIDÊNCIA A CONFERIR</small><strong>{row.action}</strong></div><div><small>PRAZO INFORMADO</small><p>{row.deadline}</p><p className="lxp-muted">Não é cálculo de vencimento.</p></div></div><footer><span>{row.lawyer}</span><div>{row.link?<a className="lxp-link" href={row.link} target="_blank" rel="noopener noreferrer">Abrir publicação <ExternalLink size={13}/></a>:<span className="lxp-muted">Link não disponível</span>} <Link className="lxp-link" href={'/processos?buscar='+encodeURIComponent(row.cnj)}>Abrir processo</Link></div></footer></article>)}</div>
 {rows.length>limit&&<ProgressiveListEnd shown={limit} total={rows.length} onMore={()=>setLimit(n=>n+60)} disabled={loading}/>}
 </main>;
}
