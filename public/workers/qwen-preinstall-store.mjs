// Stored under the CRM origin; independent of user login or logout.
// Only fixed, public Qwen model bytes; NEVER store client/process data here.
export const QWEN_PREINSTALL_DB='infinitum-qwen-preinstall-v1';
export const MODEL_CHUNK_STORE='chunks';
export const MODEL_MANIFEST_STORE='manifest';
const MANIFEST_KEY='q8';
let opened;
const result=req=>new Promise((resolve,reject)=>{
 req.onsuccess=()=>resolve(req.result);
 req.onerror=()=>reject(req.error||Error('Falha no IndexedDB'));
});
export function openQwenPreinstallDb(){
 if(typeof indexedDB==='undefined')return Promise.reject(Error('IndexedDB indisponível'));
 if(opened)return opened;
 opened=new Promise((resolve,reject)=>{
  const req=indexedDB.open(QWEN_PREINSTALL_DB,1);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains(MODEL_CHUNK_STORE))
    db.createObjectStore(MODEL_CHUNK_STORE,{keyPath:'index'});
   if(!db.objectStoreNames.contains(MODEL_MANIFEST_STORE))
    db.createObjectStore(MODEL_MANIFEST_STORE,{keyPath:'id'});
  };
  req.onerror=()=>reject(req.error||Error('O armazenamento local não abriu'));
  req.onblocked=()=>reject(Error('O banco local está ocupado'));
  req.onsuccess=()=>{
   const db=req.result;
   db.onversionchange=()=>{db.close();opened=null};
   resolve(db);
  };
 }).catch(error=>{opened=null;throw error});
 return opened;
}
async function transact(store,mode,work){
 const db=await openQwenPreinstallDb();
 return new Promise((resolve,reject)=>{
  let settled=false,value;
  const tx=db.transaction(store,mode),os=tx.objectStore(store);
  tx.oncomplete=()=>{if(!settled){settled=true;resolve(value)}};
  tx.onerror=()=>{if(!settled){settled=true;reject(tx.error||Error('Transação Qwen falhou'))}};
  tx.onabort=()=>{if(!settled){settled=true;reject(tx.error||Error('Transação Qwen cancelada'))}};
  try{
   const req=work(os);
   if(req){req.onsuccess=()=>{value=req.result};req.onerror=()=>{tx.abort()}}
  }catch(e){tx.abort();reject(e);settled=true}
 });
}
export async function getQwenManifest(){
 return (await transact(MODEL_MANIFEST_STORE,'readonly',s=>s.get(MANIFEST_KEY)))||null;
}
export async function setQwenManifest(meta){
 const value={...meta,id:MANIFEST_KEY,updatedAt:Date.now()};
 await transact(MODEL_MANIFEST_STORE,'readwrite',s=>s.put(value));
 return value;
}
export async function getQwenChunk(index){
 const value=await transact(MODEL_CHUNK_STORE,'readonly',s=>s.get(index));
 return value?.bytes||null;
}
export async function listQwenChunkIndexes(){
 return (await transact(MODEL_CHUNK_STORE,'readonly',s=>s.getAllKeys()))||[];
}
export async function saveQwenChunk(index,bytes){
 if(!Number.isSafeInteger(index)||index<0)throw Error('Índice do bloco inválido');
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(!b.length||b.length>8*1024*1024)throw Error('Bloco Qwen maior que o permitido');
 await transact(MODEL_CHUNK_STORE,'readwrite',s=>s.put({index,bytes:b}));
}
export async function clearQwenModelChunks(){
 await transact(MODEL_CHUNK_STORE,'readwrite',s=>s.clear());
 await transact(MODEL_MANIFEST_STORE,'readwrite',s=>s.clear());
}
export async function getQwenPreinstallStatus(){
 let manifest=null,indices=[];
 try{[manifest,indices]=await Promise.all([getQwenManifest(),listQwenChunkIndexes()])}
 catch{return {supported:false,complete:false,downloadedChunks:0,totalChunks:0,downloadedBytes:0,totalBytes:0}}
 const count=manifest?Math.ceil(manifest.totalBytes/manifest.chunkBytes):0;
 const complete=manifest?.complete===true&&indices.length===count&&count>0;
 return {supported:true,complete,downloadedChunks:indices.length,totalChunks:count,
  downloadedBytes:Math.min(Number(manifest?.totalBytes)||0,indices.length*(manifest?.chunkBytes||0)),
  totalBytes:Number(manifest?.totalBytes)||0};
}
export async function createChunkedModelResponse({totalBytes,chunkCount,getChunk}){
 if(!Number.isSafeInteger(totalBytes)||totalBytes<1||!Number.isSafeInteger(chunkCount)||chunkCount<1||
  typeof getChunk!=='function')throw Error('Parâmetros inválidos para cache Qwen');
 let index=0,received=0;
 const stream=new ReadableStream({
  async pull(controller){
   if(index>=chunkCount){
    if(received!==totalBytes){controller.error(Error('O cache do Qwen está incompleto'));return}
    controller.close();return;
   }
   try{
    const bytes=await getChunk(index++);
    if(!bytes)throw Error('Bloco de pesos ausente no disco');
    const chunk=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
    received+=chunk.byteLength;
    if(received>totalBytes)throw Error('Os pesos locais não correspondem ao tamanho esperado');
    controller.enqueue(chunk);
   }catch(error){controller.error(error)}
  }
 },{highWaterMark:1});
 return new Response(stream,{status:200,headers:{
  'Content-Type':'application/octet-stream','Content-Length':String(totalBytes)
 }});
}
export async function getQwenModelResponse(expectedUrl){
 const meta=await getQwenManifest();
 if(meta?.complete!==true||meta.url!==expectedUrl||
    !Number.isSafeInteger(meta.totalBytes)||meta.totalBytes<1||meta.totalBytes>1024*1024*1024||
    !Number.isSafeInteger(meta.chunkBytes)||meta.chunkBytes<1)return undefined;
 const number=Math.ceil(meta.totalBytes/meta.chunkBytes);
 const indices=await listQwenChunkIndexes();
 if(indices.length!==number)return undefined;
 return createChunkedModelResponse({totalBytes:meta.totalBytes,chunkCount:number,getChunk:getQwenChunk});
}
