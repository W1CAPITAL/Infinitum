import {DESKTOP_ENTRY_PATH} from './runtime-policy.mjs';
// Executed on Windows AFTER electron-builder has created the final win-unpacked payload.
// A pre-pack Next smoke test is insufficient: electron-builder can omit nested node_modules
// when copying standalone files into extraResources.
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const output=resolve(import.meta.dirname,'dist','win-unpacked');
const resources=join(output,'resources');
const dir=join(resources,'app-server');
const server=join(dir,'server.js');
const exe=join(output,'INFINITUM Killa AI.exe');
for(const required of [
 exe,server,join(dir,'package.json'),
 join(dir,'node_modules','next','package.json'),
 join(dir,'node_modules','next','dist','server','lib','start-server.js'),
 join(dir,'.next','BUILD_ID'),
 join(dir,'.next','static')
]){
 if(!existsSync(required))throw Error('Instalador Windows incompleto: arquivo obrigatório ausente: '+required.replace(output,''));
}
const runtimeRequire=createRequire(server);
for(const module of ['next','next/dist/server/lib/start-server']){
 try{runtimeRequire.resolve(module)}
 catch{throw Error('Next standalone não pode resolver módulo obrigatório: '+module)}
}
const packageVersion=JSON.parse(readFileSync(join(dir,'package.json'),'utf8'));
if(!packageVersion.dependencies?.next)throw Error('Pacote não declara dependência Next.js.');

if(process.platform!=='win32')throw Error('Este smoke test exige Windows e o EXE real empacotado.');

const port=await new Promise((resolvePort,reject)=>{
 const sock=createServer();
 sock.once('error',reject);
 sock.listen(0,'127.0.0.1',()=>{
  const address=sock.address();
  sock.close(error=>error?reject(error):resolvePort(address.port));
 });
});
const nonce='b'.repeat(48);
const safeEnv={};
for(const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA']){
 if(typeof process.env[key]==='string')safeEnv[key]=process.env[key];
}
const child=spawn(exe,[server],{
 cwd:dir,windowsHide:true,stdio:['ignore','ignore','pipe'],shell:false,
 env:{...safeEnv,ELECTRON_RUN_AS_NODE:'1',NODE_ENV:'production',
  HOSTNAME:'127.0.0.1',PORT:String(port),KILLA_LOCAL_NONCE:nonce,
  NEXT_PUBLIC_SUPABASE_URL:'https://segjskjlbeydlljnefai.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_yEX6mVid3dpC7o7eOzuB1g_Vh',
  NEXT_PUBLIC_LEXIS_SHARED_DB:'1'}
});
let crashed=false,signalError=null;
child.once('error',error=>{crashed=true;signalError=error?.code||'spawn_error'});
child.once('exit',code=>{crashed=true;signalError='exit '+code});
child.stderr?.resume();
let success=false;
try{
 for(let attempt=0;attempt<80;attempt++){
  if(crashed)throw Error('Servidor Next do EXE encerrou: '+signalError);
  try{
   const result=await fetch('http://127.0.0.1:'+port+'/api/desktop/health',{
    cache:'no-store',signal:AbortSignal.timeout(900)
   });
   if(result.ok){
    const body=await result.json();
    if(body?.ready===true&&body?.nonce===nonce){success=true;break}
    throw Error('Healthcheck do servidor empacotado não confere com a instância local.');
   }
  }catch(error){
   if(error.message?.startsWith('Healthcheck do servidor'))throw error;
  }
  await delay(350);
 }
 if(!success)throw Error('EXE Windows não iniciou o servidor Next empacotado.');
 // Prevent an installer with a 404 homepage from passing Windows CI.
 for(const route of [DESKTOP_ENTRY_PATH,'/whatsapp','/app-store','/app-store/admin']){
  const result=await fetch('http://127.0.0.1:'+port+route,{
   redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(7000)
  });
  if(result.status !== 200 || !result.headers.get('content-type')?.includes('text/html'))
   throw Error('EXE contém rota ausente: '+route+' (HTTP '+result.status+')');
  await result.arrayBuffer();
 }
 console.log('EXE empacotado validado: Next, login real, WhatsApp, Killa AI Store e administração sem 404.');
}finally{
 if(!child.killed)child.kill();
}
