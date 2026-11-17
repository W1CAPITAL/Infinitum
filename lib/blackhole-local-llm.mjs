'use client';
import {selectLocalQwenBackend,normalizeLocalTokenBudget,LOCAL_QWEN_RUNTIME,LOCAL_QWEN_MODELS} from './local-qwen-runtime.mjs';
import {inspectQwenModelCache,requestPersistentQwenCache} from './qwen-persistent-cache.mjs';
// Qwen is isolated in a disposable browser worker. No external inference API,
// no server, no hidden polling, and no WA.Auto transport from this module.
let worker=null,workerModel=null,active=null,serial=0,idleReleaseTimer=null,storagePreparation=null;
// Keeping ONNX weights initialized avoids reloading from disk after every
// question. After a short idle period the worker is terminated to free RAM;
// the cached weights remain on disk across F5, logout and PC restarts.
export const IDLE_RELEASE_MS=6*60*1000;
const cancelIdleRelease=()=>{
 if(idleReleaseTimer!==null){clearTimeout(idleReleaseTimer);idleReleaseTimer=null}
};
const scheduleIdleRelease=()=>{
 cancelIdleRelease();
 idleReleaseTimer=setTimeout(()=>{
  idleReleaseTimer=null;
  if(!active)stopBlackholeQwen();
 },IDLE_RELEASE_MS);
};
export async function getQwenCacheStatus(){
 return inspectQwenModelCache();
}
export function stopBlackholeQwen(){
 cancelIdleRelease();
 if(active){const job=active;active=null;job.cancel();}
 if(worker){worker.terminate();worker=null;workerModel=null}
}
export async function checkBlackholeQwenSupport({preferCpu=true,modelId=LOCAL_QWEN_RUNTIME.model}={}){
 if(typeof window==='undefined'||typeof Worker==='undefined'||typeof navigator==='undefined')
  return {ok:false,device:'none',reason:'Este navegador não suporta Web Workers para a execução isolada do Qwen.'};
 const memory=Number(navigator.deviceMemory||0);
 let webgpu=false;
 if(!preferCpu&&navigator.gpu?.requestAdapter){
  try{webgpu=Boolean(await navigator.gpu.requestAdapter({powerPreference:'low-power'}));}
  catch{/* CPU fallback if safe */}
 }
 return selectLocalQwenBackend({webgpu,memoryGb:memory,preferCpu,modelId});
}
export async function runBlackholeQwen(
 prompt,history=[],onProgress=()=>{},
 {consent=false,timeoutMs=480000,maxTokens=384,preferCpu=true,modelId=LOCAL_QWEN_RUNTIME.model}={}
){
 if(!consent)throw Error('Autorize o carregamento do modelo Qwen no navegador antes de iniciar.');
 if(active)throw Error('Já existe uma geração em andamento neste navegador.');
 cancelIdleRelease();
 if(!Object.hasOwn(LOCAL_QWEN_MODELS,modelId))throw Error('Modelo local não autorizado.');
 const support=await checkBlackholeQwenSupport({preferCpu,modelId});
 if(!support.ok)throw Error(support.reason);
 if(typeof document!=='undefined'&&document.visibilityState==='hidden')
  throw Error('Mantenha a aba aberta durante a geração local.');
 if(!storagePreparation)storagePreparation=requestPersistentQwenCache();
 const storage=await storagePreparation.catch(()=>({supported:false,persisted:false}));
 onProgress({status:'cache',message:storage.persisted
  ?'Pesos do Qwen mantidos no cache persistente do navegador.'
  :'Cache do Qwen ativo. O navegador pode limpar os arquivos quando faltar espaço.'});
 // Do not reset/terminate a warmed Qwen pipeline between questions.
 if(worker&&workerModel!==modelId)stopBlackholeQwen();
 if(!worker){worker=new Worker('/workers/blackhole-qwen-0.5b.worker.mjs',{type:'module',name:'infinitum-qwen'});workerModel=modelId;}
 else onProgress({status:'warm',message:'Reutilizando o Qwen já carregado em memória.'});
 const current=worker,id=++serial;
 const tokens=normalizeLocalTokenBudget(maxTokens);
 return new Promise((resolve,reject)=>{
  let deadline;
  const cleanup=()=>{
   if(active?.id===id)active=null;
   current.removeEventListener('message',receive);
   current.removeEventListener('error',error);
   clearTimeout(deadline);
  };
  const receive=e=>{
   if(e.data?.requestId!==id)return;
   const d=e.data;
   onProgress({status:d.status,message:d.message,progress:d.progress,file:d.file,device:d.device});
   if(d.status==='complete'){cleanup();scheduleIdleRelease();resolve({reply:String(d.text||''),model:d.model||'Qwen 0.5B',
      device:d.device||support.device,local:true});}
   if(d.status==='error'){cleanup();if(worker===current){worker.terminate();worker=null}
      reject(Error(d.error||'Modelo local indisponível.'));}
  };
  const error=()=>{cleanup();if(worker===current){worker.terminate();worker=null}
    reject(Error('A geração local falhou. Use o motor determinístico ou tente com menos tokens.'));};
  deadline=setTimeout(()=>{cleanup();if(worker===current){worker.terminate();worker=null}
    reject(Error('A execução local excedeu o tempo configurado. O worker foi interrompido sem comprometer o CRM.'));},
    Math.max(30000,Math.min(900000,Number(timeoutMs)||480000)));
  active={id,cancel:()=>{cleanup();reject(Error('Geração local cancelada.'))}};
  current.addEventListener('message',receive);current.addEventListener('error',error);
  current.postMessage({requestId:id,prompt:String(prompt||'').slice(0,6000),
    history:Array.isArray(history)?history.slice(-4):[],
    maxTokens:tokens,device:support.device,allowCpuFallback:!preferCpu&&modelId!=='onnx-community/Qwen3-4B-ONNX',modelId});
 });
}
