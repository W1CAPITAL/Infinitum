'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {getClient} from '../lib/supabase-client';
import {useCrmAccess} from '../lib/use-crm-access';
import {withAuthDeadline} from '../lib/auth-deadline.mjs';
import {subscribeKillaRealtime} from '../lib/killa-realtime.mjs';

const WorkspaceContext=createContext(null);

/**
 * Uma única sessão para todo o aplicativo. Next Link troca páginas sem
 * desmontar esse provedor; validação de permissão e Web Lock não recomeçam
 * a cada aba, mesmo em computadores com pouca RAM.
 */
export function WorkspaceSessionProvider({children}){
 const db=useMemo(()=>getClient(),[]);
 const [state,setState]=useState({session:null,loading:true,authFault:''});
 const access=useCrmAccess(db,state.session?.user);
 const [realtimeVersion,setRealtimeVersion]=useState(0);
 useEffect(()=>{
  if(!db){setState({session:null,loading:false,authFault:''});return}
  let alive=true,subscription=null,eventVersion=0;
  const {data:sub}=db.auth.onAuthStateChange((event,s)=>{
   if(!alive)return;
   eventVersion++;
   setState({session:s||null,loading:false,authFault:''});
   if(event==='PASSWORD_RECOVERY'){try{window.sessionStorage.setItem('blackhole-password-recovery','1')}catch{}}
  });
  subscription=sub.subscription;
  async function initialize(){
   const version=eventVersion;
   try{
    const {data,error}=await withAuthDeadline(db.auth.getSession(),9000);
    if(!alive||eventVersion!==version)return;
    if(error)throw error;
    setState({session:data?.session||null,loading:false,authFault:''});
   }catch(e){
    if(alive&&eventVersion===version)setState(old=>({...old,loading:false,authFault:e?.message||'A sessão não respondeu dentro do prazo.'}));
   }
  }
  initialize();
  return()=>{alive=false;subscription?.unsubscribe()};
 },[db]);
 useEffect(()=>{
  const ownerId=state.session?.user?.id;
  if(!db||!ownerId||access.allowed!==true)return undefined;
  let timer=null;
  const unsubscribe=subscribeKillaRealtime(db,ownerId,({table})=>{
   if(timer===null)timer=setTimeout(()=>{timer=null;setRealtimeVersion(v=>v+1)},500);
   // No client message content or personal data in cross-component signals.
   if(typeof window!=='undefined')
    window.dispatchEvent(new CustomEvent('killa:realtime',{detail:{table}}));
  });
  return()=>{if(timer!==null)clearTimeout(timer);unsubscribe()};
 },[db,state.session?.user?.id,access.allowed]);
 const value=useMemo(()=>({db,realtimeVersion,session:state.session,loading:state.loading,
  authFault:state.authFault,access}),[db,state,realtimeVersion,access.loading,access.allowed,access.denied,access.error]);
 return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspaceSession(){
 const ctx=useContext(WorkspaceContext);
 if(!ctx)throw new Error('BLACKHOLE necessita do provedor persistente de autenticação.');
 return ctx;
}
