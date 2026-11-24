'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {Activity,AlertTriangle,ArrowUpRight,BarChart3,BriefcaseBusiness,CheckCircle2,ClipboardList,Clock3,FileCheck2,FileText,MessageSquareText,Scale,Search,ShieldCheck,Users} from 'lucide-react';
import {answerReportQuestion,executiveSeries,reportDistribution} from '../lib/infinitum-report-executive.mjs';

const fmt=x=>x==null?'—':typeof x==='number'?x.toLocaleString('pt-BR'):String(x);
const valid=x=>x!=null&&Number.isFinite(Number(x));
function Metric({label,value,detail,Icon,tone='neutral'}){
 return <div className="ixr-metric" data-tone={tone}><div className="ixr-metric-top">{Icon&&<span className="ixr-icon"><Icon size={19}/></span>}<span>{label}</span></div><strong>{fmt(value)}</strong>{detail&&<small>{detail}</small>}</div>;
}
function Panel({title,subtitle,children,wide=false,id}){
 return <section id={id} className={'ixr-panel'+(wide?' ixr-wide':'')}><header><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</header>{children}</section>;
}
function Timeline({days}){
 const width=620,height=218,left=38,right=14,top=18,bottom=32;
 const max=Math.max(1,...days.flatMap(d=>[d.atendimentos,d.encerramentos]).filter(valid).map(Number));
 const px=i=>left+i*(width-left-right)/Math.max(1,days.length-1);
 const py=n=>height-bottom-(height-top-bottom)*Number(n)/max;
 const series=[['atendimentos','Atendimentos','#237e9d'],['encerramentos','Encerramentos manuais','#168d82']];
 const segments=key=>{let out=[],points=[];days.forEach((d,i)=>{if(valid(d[key]))points.push(px(i)+','+py(d[key]));else if(points.length){out.push(points);points=[]}});if(points.length)out.push(points);return out};
 if(!days.some(d=>valid(d.atendimentos)||valid(d.encerramentos)))return <p className="ixr-empty">Série diária indisponível nesta consulta.</p>;
 const ticks=[...new Set([0,Math.round(max*.25),Math.round(max*.5),Math.round(max*.75),max])];
 return <><svg className="ixr-chart" viewBox={'0 0 '+width+' '+height} role="img" aria-label="Evolução diária de atendimentos e encerramentos">
 {ticks.map(n=><g key={n}><line x1={left} y1={py(n)} x2={width-right} y2={py(n)} stroke="var(--ixr-line)" strokeDasharray="3 5"/><text x={left-7} y={py(n)+3} textAnchor="end" fill="var(--ixr-muted)" fontSize="10">{fmt(n)}</text></g>)}
 {series.map(([key,label,color])=><g key={key}>{segments(key).map((p,i)=><polyline key={i} points={p.join(' ')} stroke={color} strokeWidth="2.8" fill="none" strokeLinejoin="round" strokeLinecap="round"/>)}{days.map((d,i)=>valid(d[key])?<circle key={d.ymd} cx={px(i)} cy={py(d[key])} r="3.2" fill={color}><title>{d.ymd.split('-').reverse().join('/')} · {label}: {fmt(d[key])}</title></circle>:null)}</g>)}
 {days.map((d,i)=>(i===0||i===days.length-1||i%Math.max(1,Math.ceil(days.length/7))===0)?<text key={d.ymd} x={px(i)} y={height-9} textAnchor="middle" fontSize="10" fill="var(--ixr-muted)">{d.ymd.slice(8)+'/'+d.ymd.slice(5,7)}</text>:null)}
 </svg><div className="ixr-legend">{series.map(([key,label,color])=><span key={key}><i style={{background:color}}/>{label}{!days.some(d=>valid(d[key]))?' · indisponível':''}</span>)}</div></>;
}
function Distribution({headline}){
 const values=reportDistribution(headline),total=headline.total;
 if(!values||!total)return <p className="ixr-empty">Distribuição indisponível ou carteira sem processos.</p>;
 let offset=0;
 return <><div className="ixr-donut"><svg viewBox="0 0 160 160" role="img" aria-label="Distribuição da carteira"><circle cx="80" cy="80" r="60" stroke="var(--ixr-soft)" strokeWidth="19" fill="none"/>{values.map(d=>{const pct=100*d.value/total,prev=offset;offset+=pct;return pct>0?<circle key={d.label} cx="80" cy="80" r="60" pathLength="100" stroke={d.color} strokeWidth="19" strokeDasharray={pct+' '+(100-pct)} strokeDashoffset={-prev} transform="rotate(-90 80 80)" fill="none"><title>{d.label}: {fmt(d.value)}</title></circle>:null})}</svg><div><strong>{fmt(total)}</strong><small>processos</small></div></div>
 <div className="ixr-distribution">{values.map(d=><div key={d.label}><span><i style={{background:d.color}}/>{d.label}</span><b>{fmt(d.value)}</b></div>)}</div></>;
}
function DataTable({columns,rows,empty='Nenhum detalhamento disponível nesta consulta.'}){
 if(!rows?.length)return <p className="ixr-empty">{empty}</p>;
 return <div className="ixr-table-wrap"><table><thead><tr>{columns.map(c=><th key={c} scope="col">{c}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{fmt(v)}</td>)}</tr>)}</tbody></table></div>;
}
function Details({sections}){
 return <div className="ixr-details">{sections.map(section=><Panel key={section.id} id={'ixr-'+section.id} title={section.title} subtitle={section.subtitle}><div className="ixr-detail-grid">{section.metrics.map(m=><Metric key={m.label} label={m.label} value={m.value}/>)}</div>{section.columns&&<DataTable columns={section.columns} rows={section.rows}/>} {section.secondary&&<><h3>Trabalho por colaborador</h3><DataTable {...section.secondary}/></>}<p className="ixr-note">{section.note}</p></Panel>)}</div>;
}
export default function InfinitumExecutiveReport({report,model,sections,periodLabel}){
 const [tab,setTab]=useState('overview'),[metric,setMetric]=useState('carteira'),[person,setPerson]=useState('todos'),[expanded,setExpanded]=useState(false),[question,setQuestion]=useState(''),[asked,setAsked]=useState('');
 const h=model.headline;
 const days=useMemo(()=>executiveSeries(report?.historico||{}),[report]);
 const readMetric=p=>metric==='carteira'?p.carteira?.total:metric==='atendimentos'?p.atendimentos?.eventos:p.atividades?.registrosTotal;
 const people=useMemo(()=>[...model.team].sort((a,b)=>(Number(readMetric(b))||0)-(Number(readMetric(a))||0)),[model.team,metric]);
 const visible=person==='todos'?people:people.filter(p=>p.userId===person);
 const ranked=expanded?visible:visible.slice(0,6),max=Math.max(1,...visible.map(p=>Number(readMetric(p))||0));
 const longReturn=report?.retorno?.semRetornoLongo,merit=report?.merito?.oficial?.nao_determinados;
 const warnings=[['Retornos a conferir',longReturn,'Ativos sem retorno há 30 dias ou mais',Clock3,'/tarefas?tipo=retorno'],['Vencidos no CRM',h.vencidos,'Classificação cadastral, não prazo judicial confirmado',AlertTriangle,'/vencidos'],['Resultados a esclarecer',merit,'Classificações de mérito ainda inconclusivas',Scale,'/processos']];
 const ask=q=>{setQuestion(q);setAsked(q)};
 return <div className="ixr-report report-completo-shell">
 <section className="ixr-hero"><div><span className="ixr-eyebrow"><BarChart3 size={16}/> INFINITUM / INTELIGÊNCIA OPERACIONAL</span><h1>Relatórios operacionais</h1><p>Carteira, produtividade e auditoria jurídica. Compare o trabalho registrado no período com a situação atual dos processos.</p><div className="ixr-hero-links"><Link href="/processos">Carteira de processos <ArrowUpRight size={15}/></Link><button type="button" onClick={()=>setTab('details')}>Relatório detalhado <ArrowUpRight size={15}/></button></div></div><div className="ixr-hero-number"><span>CARTEIRA DISPONÍVEL</span><strong>{fmt(h.total)}</strong><small>{periodLabel} · Dados da sessão autorizada</small></div></section>
 <nav className="ixr-tabs" aria-label="Seções do relatório">{[['overview','Visão executiva'],['details','Mérito e auditorias'],['questions','Consultar os dados']].map(([id,name])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)} type="button">{name}</button>)}<a href="#equipe">Equipe e atividades <ArrowUpRight size={14}/></a></nav>
 {tab==='overview'&&<>
 <div className="ixr-kpis">
 <Metric label="Carteira total" value={h.total} Icon={BriefcaseBusiness} detail="Fotografia atual" tone="blue"/><Metric label="Ativos" value={h.ativos} Icon={Activity} detail="Situação no CRM" tone="teal"/><Metric label="Encerrados" value={h.encerrados} Icon={CheckCircle2} detail="Não equivale a julgamento" tone="purple"/><Metric label="Com novidade" value={h.novidades} Icon={FileCheck2} detail="Snapshot atual" tone="blue"/><Metric label="Sem retorno 30d+" value={longReturn} Icon={Clock3} detail="Ativos a acompanhar" tone="amber"/><Metric label="Atendimentos" value={h.atendimentos} Icon={Users} detail={periodLabel} tone="teal"/><Metric label="Atividades cadastradas" value={h.atividadesHistorico} Icon={ClipboardList} detail="Histórico completo" tone="purple"/>
 </div>
 <div className="ixr-overview-grid">
 <Panel title="Evolução de atendimentos e encerramentos" subtitle={'Registros diários · '+periodLabel} wide><Timeline days={days}/></Panel>
 <Panel title="Distribuição da carteira" subtitle="Estados atuais do cadastro"><Distribution headline={h}/></Panel>
 <Panel title="Carteira e produtividade por responsável" subtitle="Compare atribuição, atendimento ou atividades. As medidas são distintas." wide><div className="ixr-filter-row"><label>Responsável<select value={person} onChange={e=>setPerson(e.target.value)}><option value="todos">Todos os colaboradores</option>{people.map(p=><option key={p.userId} value={p.userId}>{p.nome}</option>)}</select></label><label>Comparar<select value={metric} onChange={e=>setMetric(e.target.value)}><option value="carteira">Carteira atribuída</option><option value="atendimentos">Atendimentos no período</option><option value="atividades">Atividades · histórico</option></select></label></div>
 <div className="ixr-ranks">{ranked.map(p=><div key={p.userId}><span title={p.nome}>{p.nome}</span><div><i style={{width:valid(readMetric(p))?Math.max(0,100*Number(readMetric(p))/max)+'%':'0%'}}/></div><b>{fmt(readMetric(p))}</b></div>)}</div>{!ranked.length&&<p className="ixr-empty">Dados individuais indisponíveis para este perfil.</p>}{visible.length>6&&<button className="inf-btn" type="button" onClick={()=>setExpanded(v=>!v)}>{expanded?'Ver menos':'Ver todos'}</button>}</Panel>
 <Panel title="Auditoria e risco" subtitle="Pontos de atenção confirmados">{warnings.map(([label,val,detail,Icon,href])=><Link key={label} className="ixr-risk" href={href}><Icon size={18}/><div><b>{label}</b><small>{detail}</small></div><strong>{fmt(val)}</strong><ArrowUpRight size={15}/></Link>)}</Panel>
 <Panel title="Produtividade da equipe" subtitle="Indicadores do período e histórico completo" wide><DataTable columns={['Responsável','Carteira','Atendimentos','Encerramentos','Edições','Atividades · histórico']} rows={visible.map(p=>[p.nome,p.carteira?.total,p.atendimentos?.eventos,p.encerramentos?.processos,p.edicoes?.processos,p.atividades?.registrosTotal])}/></Panel>
 <Panel title="Atendimento" subtitle="Eventos e processos distintos"><div className="ixr-contact"><Metric label="Processos atendidos" value={h.processosAtendidos} Icon={Users}/><Metric label="Eventos de atendimento" value={h.atendimentos} Icon={Activity}/></div><Link className="inf-btn" href="/whatsapp">Abrir WhatsApp <ArrowUpRight size={15}/></Link><p className="ixr-note">Não equivale a volume de mensagens do WhatsApp.</p></Panel>
 </div></>}
 {tab==='details'&&<Details sections={sections}/>}
 {tab==='questions'&&<Panel title="Consultar os dados do relatório" subtitle="Respostas locais baseadas nos indicadores da consulta. Sem enviar dados a provedores externos."><div className="ixr-question"><div className="ixr-suggestions">{['Quais são as prioridades?','Resumo dos encerramentos','Auditorias e trabalho interno','Total da carteira'].map(q=><button type="button" key={q} onClick={()=>ask(q)}>{q}</button>)}</div><form onSubmit={e=>{e.preventDefault();setAsked(question)}}><MessageSquareText size={19}/><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Pergunte sobre a carteira ou um colaborador" aria-label="Pergunta sobre o relatório"/><button className="inf-btn primary" disabled={!question.trim()} type="submit">Consultar</button></form>{asked&&<div className="ixr-answer" role="status"><b>{asked}</b><p>{answerReportQuestion(asked,model,sections)}</p></div>}</div></Panel>}
 </div>;
}
