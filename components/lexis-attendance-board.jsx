'use client';
const n=x=>Number(x??0).toLocaleString('pt-BR');
const friendlyDay=x=>x?x.split('-').reverse().join('/'):'hoje';
export default function LexisAttendanceBoard({audit,userId,compact=false}){
 const data=audit?.data,loading=audit?.loading;
 return <section className="inf-panel" aria-label="Atendimentos auditados por operador"
  style={{padding:'18px 20px',margin:'16px 0',borderRadius:14}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'baseline',flexWrap:'wrap'}}>
   <div><small style={{fontWeight:700,letterSpacing:'.06em'}}>AUDITORIA DO CRM · HOJE</small>
    <h2 style={{fontSize:'1.12rem',margin:'5px 0'}}>Atendimentos por operador</h2></div>
   <small>{data?friendlyDay(data.today):'São Paulo'}</small>
  </div>
  {loading&&!data&&<p role="status">Carregando atendimentos registrados na auditoria...</p>}
  {audit?.error&&<p role="alert" className="inf-note error">{audit.error}. Nenhum zero foi presumido.</p>}
  {data&&<><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))',gap:10,margin:'14px 0'}}>
    <div style={{padding:14,border:'1px solid var(--crm-border,#d5dbe2)',borderRadius:10}}>
     <small>Equipe · processos distintos hoje</small>
     <strong style={{display:'block',fontSize:'1.85rem',fontVariantNumeric:'tabular-nums'}}>{n(data.todayTotal)}</strong>
    </div>
    <div style={{padding:14,border:'1px solid var(--crm-border,#d5dbe2)',borderRadius:10}}>
     <small>Meus processos atendidos hoje</small>
     <strong style={{display:'block',fontSize:'1.85rem',fontVariantNumeric:'tabular-nums'}}>{n(data.personalToday)}</strong>
    </div>
   </div>
   {data.operatorsToday.length?<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))',gap:10}}>
    {data.operatorsToday.map(op=><div key={op.userId} style={{padding:'12px 14px',border:'1px solid var(--crm-border,#d5dbe2)',borderRadius:10}}>
     <strong style={{display:'block',overflowWrap:'anywhere'}}>{op.nome}{op.userId===userId?' · Você':''}</strong>
     <span style={{display:'block',fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{n(op.processos)} {op.processos===1?'processo':'processos'}</span>
     {!compact&&<small>{n(op.eventos)} {op.eventos===1?'evento auditado':'eventos auditados'}</small>}
    </div>)}
   </div>:<p className="inf-note">Não há operadores com atendimento auditado hoje.</p>}
   <p className="inf-note" style={{margin:'12px 0 0'}}>
    Fonte: auditoria de atendimento/encerramento manual; um CNJ por operador e por dia.
    {data.overlapPossible?' Um mesmo processo pode aparecer para mais de um operador, sem duplicar o total da equipe.':''}
    {' '}Retornos agendados concluídos por data são outro indicador.
   </p></>}
 </section>;
}
