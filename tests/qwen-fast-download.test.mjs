import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseQwenDownloadConcurrency,downloadQwenChunks,QWEN_CHUNK_BYTES} from '../lib/qwen-preinstall-policy.mjs';
test('browser preinstaller selects safe parallel download count without overloading weak PCs',()=>{
 assert.equal(chooseQwenDownloadConcurrency({memoryGb:4,effectiveType:'4g',downlink:5}),2);
 assert.equal(chooseQwenDownloadConcurrency({memoryGb:8,effectiveType:'4g',downlink:20}),3);
 assert.equal(chooseQwenDownloadConcurrency({memoryGb:0,effectiveType:'4g',downlink:20}),2);
 assert.equal(chooseQwenDownloadConcurrency({memoryGb:2,effectiveType:'4g',downlink:20}),1);
 assert.equal(chooseQwenDownloadConcurrency({memoryGb:16,effectiveType:'3g',downlink:20}),1);
 assert.equal(chooseQwenDownloadConcurrency({memoryGb:16,effectiveType:'4g',downlink:2,saveData:true}),1);
});
test('Qwen downloads remaining blocks concurrently without redownloading completed chunks',async()=>{
 const completed=new Set([0,2]),read=[],saved=[],active={count:0,peak:0};
 const result=await downloadQwenChunks({
  totalBytes:6*QWEN_CHUNK_BYTES,completed,concurrency:3,
  async readRange(part){
   active.count++;active.peak=Math.max(active.peak,active.count);
   read.push(part.index);
   await new Promise(resolve=>setTimeout(resolve,8));
   active.count--;
   return {bytes:new Uint8Array(part.end-part.start+1),total:6*QWEN_CHUNK_BYTES};
  },
  async writeChunk(index,bytes){saved.push(index);assert.equal(bytes.length,QWEN_CHUNK_BYTES)}
 });
 assert.equal(active.peak,3);
 assert.deepEqual(read.sort((a,b)=>a-b),[1,3,4,5]);
 assert.deepEqual(saved.sort((a,b)=>a-b),[1,3,4,5]);
 assert.equal(result.completed.size,6);
});
test('download cancellation prevents additional chunk writes',async()=>{
 const completed=new Set();
 const abort={aborted:false};
 let saved=0;
 await assert.rejects(downloadQwenChunks({
  totalBytes:5*QWEN_CHUNK_BYTES,completed,concurrency:2,
  isPaused:()=>abort.aborted,
  async readRange(part){if(part.index===0){abort.aborted=true;return {bytes:new Uint8Array(QWEN_CHUNK_BYTES)}};return {bytes:new Uint8Array(QWEN_CHUNK_BYTES)}},
  async writeChunk(){saved++}
 }),/pausada/i);
 assert.equal(saved,0);
});
test('download verifies byte lengths and never persists invalid chunks',async()=>{
 let writes=0;
 await assert.rejects(downloadQwenChunks({
  totalBytes:QWEN_CHUNK_BYTES,concurrency:2,completed:new Set(),
  async readRange(){return {bytes:new Uint8Array(17),total:QWEN_CHUNK_BYTES}},
  async writeChunk(){writes++}
 }),/incompleto|tamanho/i);
 assert.equal(writes,0);
});
