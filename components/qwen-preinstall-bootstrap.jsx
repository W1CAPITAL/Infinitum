'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {canPrefetchQwen,QWEN_PREINSTALL_ORIGIN,chooseQwenDownloadConcurrency} from '../lib/qwen-preinstall-policy.mjs';
import {getQwenCacheStatus} from '../lib/blackhole-local-llm.mjs';

// No model inference, wasm compilation or 512MB buffering on the UI thread.
// Download only on the stable domain; private CRM and WhatsApp data are NEVER
// transferred to the model host. On reload the worker resumes saved chunks.
export default function QwenPreinstallBootstrap(){
 const pathname=usePathname();
 useEffect(()=>{
  // The standalone OpenBot Studio loads local models only after explicit consent.
  if(pathname!=='/agentes'&&pathname!=='/superagente')return;
  try{if(localStorage.getItem('infinitum.qwen.preinstall.enabled')!=='1')return}catch{return;}
  if(typeof window==='undefined'||window.location.hostname!==QWEN_PREINSTALL_ORIGIN)return;
  if(typeof Worker==='undefined'||!navigator.storage?.estimate)return;
  let stopped=false,installer=null,renew=null;
  const key='infinitum.qwen.preinstall.lease';
  const ticket=Math.random().toString(36).slice(2);
  const release=()=>{
   if(renew){clearInterval(renew);renew=null}
   try{
    const lease=JSON.parse(localStorage.getItem(key)||'null');
    if(lease?.ticket===ticket)localStorage.removeItem(key);
   }catch{}
   if(installer){installer.terminate();installer=null}
  };
  const lease=()=>{
   try{
    const now=Date.now(),old=JSON.parse(localStorage.getItem(key)||'null');
    if(old?.until>now&&old?.ticket!==ticket)return false;
    localStorage.setItem(key,JSON.stringify({ticket,until:now+60000}));
    return true;
   }catch{return true}
  };
  const start=async()=>{
   if(stopped||document.visibilityState!=='visible'||installer)return;
   try{
    const [storage,cache]=await Promise.all([
     navigator.storage.estimate(),
     getQwenCacheStatus()
    ]);
    if(cache.complete)return;
    const conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    const free=(Number(storage.quota)||0)-(Number(storage.usage)||0);
    const eligible=canPrefetchQwen({
     visible:true,memoryGb:Number(navigator.deviceMemory||0),
     freeBytes:free+(Number(cache.preinstallBytes)||0),
     saveData:conn?.saveData===true,effectiveType:conn?.effectiveType||'4g',
     sameStableOrigin:true
    });
    if(!eligible.ok||stopped||!lease())return;
    installer=new Worker('/workers/qwen-installer.worker.mjs',{
     type:'module',name:'infinitum-qwen-background-install'
    });
    const current=installer;
    current.addEventListener('message',event=>{
     if(stopped)return;
     if(event.data?.type!=='qwen-preinstall')return;
     if(['complete','paused','error'].includes(event.data.status)){
      release();
     }
    });
    current.addEventListener('error',release);
    renew=setInterval(()=>{if(stopped)return;lease()},30000);
    current.postMessage({type:'start',concurrency:chooseQwenDownloadConcurrency({
      memoryGb:Number(navigator.deviceMemory||0),saveData:conn?.saveData===true,
      effectiveType:conn?.effectiveType||'4g',downlink:Number(conn?.downlink||0)
    })});
   }catch{release()}
  };
  const initial=setTimeout(start,3500);
  const onOnline=()=>{if(!installer&&!stopped)start()};
  window.addEventListener('online',onOnline);
  return()=>{
   stopped=true;clearTimeout(initial);
   window.removeEventListener('online',onOnline);
   release();
  };
 },[pathname]);
 return null;
}
