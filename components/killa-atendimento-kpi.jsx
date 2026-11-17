'use client';
import {useEffect,useState} from 'react';
export default function KillaAtendimentoKpi({db,session}){
 const [kpi,setKpi]=useState(null);
 useEffect(()=>{
  if(!db||!session?.user?.id)return;
  let live=true;
  const reload=()=>db.auth.getSession().then(({data})=>{
   const token=data?.session?.access_token;
   if(!token)return;
   return fetch('/api/office/agent/kpis',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
    .then(r=>r.json()).then(x=>{if(live)setKpi(x)});
  }).catch(()=>{if(live)setKpi(null)});
  reload();
  let timer=null;
  const onRealtime=event=>{
   if(event?.detail?.table!=='killa_mcp_send_intents')return;
   if(timer!==null)clearTimeout(timer);
   timer=setTimeout(reload,450);
  };
  window.addEventListener('killa:realtime',onRealtime);
  return()=>{live=false;window.removeEventListener('killa:realtime',onRealtime);if(timer!==null)clearTimeout(timer)};
 },[db,session?.user?.id]);
 if(!kpi?.ok)return null;
 return <section className="inf-panel" aria-label="KPI de atendimentos OpenBot" style={{padding:16,marginTop:16}}>
  <h3>Killa AI / OpenBot · atendimentos confirmados</h3>
  <p><strong>{kpi.total}</strong> atendimentos aceitos pelo WA.Auto nos últimos 30 dias.</p>
  <p><strong>{kpi.openbot||0}</strong> OpenBot · <strong>{kpi.mcp||0}</strong> apps MCP</p>
  {Object.entries(kpi.byClient||{}).map(([app,n])=><p key={app}>App: <strong>{app}</strong> · {n} atendimentos</p>)}
  {kpi.byOperator?.map(x=><p key={x.userId}>Responsável: <strong>{x.displayName}</strong> · {x.accepted} atendimentos</p>)}
  <small>{kpi.notice}</small>
  {!kpi.available&&<p>Fonte indisponível nesta carteira; nenhum envio foi presumido.</p>}
 </section>;
}
