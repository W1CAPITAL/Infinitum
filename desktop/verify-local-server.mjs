import {DESKTOP_ENTRY_PATH} from './runtime-policy.mjs';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const dir=resolve(import.meta.dirname,'app-server'),server=join(dir,'server.js');
if(!existsSync(server))throw Error('Servidor Next standalone não empacotado.');
const port=await new Promise((resolvePort,reject)=>{
 const s=createServer();s.once('error',reject);
 s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(err=>err?reject(err):resolvePort(p))});
});
const nonce='a'.repeat(48),failures=[];
const child=spawn(process.execPath,[server],{
 cwd:dir,windowsHide:true,stdio:['ignore','ignore','pipe'],
 env:{...process.env,PORT:String(port),HOSTNAME:'127.0.0.1',
  NODE_ENV:'production',KILLA_LOCAL_NONCE:nonce,ELECTRON_RUN_AS_NODE:undefined}
});
child.on('error',err=>failures.push(String(err.message||err)));
child.on('exit',code=>failures.push('Servidor encerrado: '+code));
child.stderr.on('data',buf=>{
 const text=String(buf).slice(0,1200);
 if(/error|exception|fatal/i.test(text))failures.push('Erro do servidor local (log resumido)');
});
let success=false;
try{
 for(let i=0;i<85;i++){
  if(failures.length)throw Error(failures.join('; ').slice(0,300));
  try{
   const res=await fetch('http://127.0.0.1:'+port+'/api/desktop/health',{
    signal:AbortSignal.timeout(800),cache:'no-store'
   });
   if(res.ok){
    const data=await res.json();
    if(data.ready===true&&data.nonce===nonce){success=true;break}
    throw Error('A origem local não corresponde ao processo autenticado.');
   }
  }catch(error){
   if(error.message?.includes('origem local'))throw error;
  }
  await delay(330);
 }
 if(!success)throw Error('O servidor Next local não passou na verificação de integridade.');
 // A green healthcheck does not prove the Electron landing page exists.
 for(const route of [DESKTOP_ENTRY_PATH,'/whatsapp','/app-store','/app-store/admin']){
  const response=await fetch('http://127.0.0.1:'+port+route,{
   cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(7000)
  });
  if(response.status !== 200 || !response.headers.get('content-type')?.includes('text/html'))
   throw Error('Rota do aplicativo indisponível no instalador: '+route+' (HTTP '+response.status+')');
  await response.arrayBuffer();
 }
}finally{
 child.kill();
}
if(!success)throw Error('O servidor Next instalado não respondeu ao desafio local.');
console.log('Servidor Next standalone validado em loopback, sem Vercel e sem chaves privadas.');
