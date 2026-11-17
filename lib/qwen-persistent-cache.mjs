// Stable origin-local browser cache. Reuse Transformers.js DEFAULT cache key
// to preserve older Qwen model files after updates. Cache persists across F5,
// logouts and restarts unless browser/site-data settings evict or clear it.
export const MODEL_CACHE_KEY='transformers-cache';
export const MODEL_ID='onnx-community/Qwen2.5-0.5B-Instruct';
const bytes=x=>Number.isFinite(Number(x))?Math.max(0,Math.round(Number(x))):null;
const storageDefault=()=>typeof navigator==='undefined'?null:navigator.storage||null;
const cachesDefault=()=>typeof caches==='undefined'?null:caches;
// Read-only state: no weights are copied into React/browser RAM here.
async function readPreinstallIndex(){
 if(typeof indexedDB==='undefined')return {ready:false,bytes:0,total:0,chunks:0,expected:0};
 try{
  const db=await new Promise((resolve,reject)=>{
   const r=indexedDB.open('infinitum-qwen-preinstall-v1',1);
   r.onupgradeneeded=()=>{
    if(!r.result.objectStoreNames.contains('chunks'))
     r.result.createObjectStore('chunks',{keyPath:'index'});
    if(!r.result.objectStoreNames.contains('manifest'))
     r.result.createObjectStore('manifest',{keyPath:'id'});
   };
   r.onsuccess=()=>resolve(r.result);
   r.onerror=()=>reject(r.error);
  });
  try{
   const result=await new Promise((resolve,reject)=>{
    const tx=db.transaction(['manifest','chunks'],'readonly');
    let meta=null,keys=[];
    const mr=tx.objectStore('manifest').get('q8');
    const kr=tx.objectStore('chunks').getAllKeys();
    mr.onsuccess=()=>{meta=mr.result};
    kr.onsuccess=()=>{keys=kr.result||[]};
    tx.oncomplete=()=>resolve({meta,keys});
    tx.onerror=()=>reject(tx.error);
   });
   const meta=result.meta,expected=meta?Math.ceil(meta.totalBytes/meta.chunkBytes):0;
   const ready=meta?.complete===true&&expected>0&&result.keys.length===expected;
   return {ready,bytes:Math.min(Number(meta?.totalBytes||0),
    result.keys.length*Number(meta?.chunkBytes||0)),
    total:Number(meta?.totalBytes||0),chunks:result.keys.length,expected};
  }finally{db.close()}
 }catch{return {ready:false,bytes:0,total:0,chunks:0,expected:0}}
}
export async function inspectQwenModelCache({storage=storageDefault(),cacheStorage=cachesDefault()}={}){
 let persisted=false,quotaBytes=null,usageBytes=null,cachedFiles=0,modelInBrowserCache=false;
 const preinstall=await readPreinstallIndex();
 if(storage){
  try{persisted=typeof storage.persisted==='function'&&await storage.persisted()===true;}catch{}
  try{const estimate=await storage.estimate?.();quotaBytes=bytes(estimate?.quota);usageBytes=bytes(estimate?.usage);}catch{}
 }
 if(cacheStorage){
  try{
   if(await cacheStorage.has(MODEL_CACHE_KEY)){
    const cache=await cacheStorage.open(MODEL_CACHE_KEY);
    const keys=await cache.keys();
    cachedFiles=keys.filter(k=>String(k.url||'').includes('Qwen2.5-0.5B-Instruct')).length;
    modelInBrowserCache=keys.some(k=>{const url=String(k.url||'');return url.includes('Qwen2.5-0.5B-Instruct')&&(url.includes('/onnx/model_quantized.onnx')||url.includes('/onnx/model_q4.onnx'));});
   }
  }catch{}
 }
 return {supported:!!storage&&!!cacheStorage,persisted,cacheKey:MODEL_CACHE_KEY,
  cachedFiles,complete:modelInBrowserCache||preinstall.ready,
  preinstallChunks:preinstall.chunks,preinstallTotalChunks:preinstall.expected,
  preinstallBytes:preinstall.bytes,preinstallTotalBytes:preinstall.total,
  quotaBytes,usageBytes,
  note:preinstall.ready?'Pesos do Qwen já preparados no disco, sem necessidade de download inicial.':
    preinstall.chunks>0?'Pré-instalação em andamento; partes salvas e recuperáveis após F5 e reinicialização.':
    cachedFiles>0?'Alguns arquivos do Qwen já estão no cache; os pesos podem ainda estar pendentes.':
    'Pré-instalação ainda não iniciada neste domínio.'};
}
export async function requestPersistentQwenCache({storage=storageDefault()}={}){
 if(!storage)return {supported:false,persisted:false,reason:'storage_api_unavailable'};
 let persisted=false;
 try{persisted=typeof storage.persisted==='function'&&await storage.persisted()===true;}catch{}
 if(!persisted&&typeof storage.persist==='function'){
  try{persisted=await storage.persist()===true;}catch{}
 }
 let quotaBytes=null,usageBytes=null;
 try{
  const estimate=await storage.estimate?.();
  quotaBytes=bytes(estimate?.quota);usageBytes=bytes(estimate?.usage);
 }catch{}
 return {supported:true,persisted,quotaBytes,usageBytes,
  reason:persisted?'persistent_storage_granted':'browser_may_evict',
  note:persisted
   ?'Cache do Qwen com armazenamento persistente autorizado pelo navegador.'
   :'Cache do Qwen ativado. O navegador pode remover dados sob pressão de espaço ou ao limpar dados do site.'};
}
