'use client';
import {useEffect,useRef} from 'react';

// A lista mantém os itens anteriores; o botão também funciona sem IntersectionObserver.
export default function ProgressiveListEnd({shown,total,onMore,disabled=false}){
 const target=useRef(null);
 const busy=useRef(false);
 useEffect(()=>{
  busy.current=false;
  if(disabled||shown>=total||!target.current||typeof IntersectionObserver==='undefined')return;
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)&&!busy.current){
    busy.current=true;
    observer.disconnect();
    onMore();
   }
  },{rootMargin:'160px'});
  observer.observe(target.current);
  return()=>observer.disconnect();
 },[shown,total,onMore,disabled]);
 return <div ref={target} className="inf-row-end" role="status">
  <span>Mostrando {shown.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')} registros</span>
  {shown<total&&<button type="button" className="inf-btn" disabled={disabled} onClick={()=>{if(!busy.current){busy.current=true;onMore()}}}>Exibir próximos registros</button>}
 </div>;
}
