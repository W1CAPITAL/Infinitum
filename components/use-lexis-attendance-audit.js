'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {fetchLexisAttendanceAudit} from '../lib/lexis-attendance-audit.mjs';
const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
export function useLexisAttendanceAudit(db,company,userId){
 const [state,setState]=useState({loading:true,error:'',data:null});
 const lastRequest=useRef(0);
 const scope=useRef('');
 const refresh=useCallback(async()=>{
  const request=++lastRequest.current;
  const nextScope=String(company||'')+'|'+String(userId||'');
  if(!company||!userId){scope.current=nextScope;setState({loading:false,error:'',data:null});return}
  if(scope.current!==nextScope){scope.current=nextScope;setState({loading:true,error:'',data:null});}
  else setState(old=>({...old,loading:true,error:''}));
  try{
   const data=await fetchLexisAttendanceAudit(db,company,{userId,today:today()});
   if(request===lastRequest.current)setState({loading:false,error:'',data});
  }catch(e){
   if(request===lastRequest.current)setState({loading:false,error:String(e?.message||e),data:null});
  }
 },[db,company,userId]);
 useEffect(()=>{
  refresh();
  if(typeof window==='undefined')return;
  const onFocus=()=>refresh();
  const onVisible=()=>{if(document.visibilityState==='visible')refresh()};
  window.addEventListener('focus',onFocus);
  window.addEventListener('lexis:attendance-registered',onFocus);
  document.addEventListener('visibilitychange',onVisible);
  return()=>{
   lastRequest.current++;
   window.removeEventListener('focus',onFocus);
   window.removeEventListener('lexis:attendance-registered',onFocus);
   document.removeEventListener('visibilitychange',onVisible);
  };
 },[refresh]);
 return {...state,refresh};
}
