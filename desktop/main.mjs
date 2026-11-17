import {app,BrowserWindow,ipcMain,dialog,shell,Menu} from 'electron';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {join} from 'node:path';
import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createFreeUpdater} from './free-update-client.mjs';
import {setTimeout as sleep} from 'node:timers/promises';
import {validateDesktopConfig,safeStandaloneEnvironment,isLocalAppNavigation,
 isSafeExternalNavigation,isSafeZapFastNavigation,DESKTOP_ZAPFAST_URL,shouldRunSignedUpdater,DESKTOP_ENTRY_PATH} from './runtime-policy.mjs';
import {safeLauncherSnapshot,normalizeUpdateProgress,canInstallSignedUpdate,isSignedUpdateConfiguration} from './launcher-policy.mjs';
import {secondInstanceAction,canReuseLocalServer} from './lifecycle-policy.mjs';

const CONFIG_ENDPOINT='https://segjskjlbeydlljnefai.supabase.co/functions/v1/infinitum-desktop-config';
let nextProcess=null,port=0,desktopConfig=null,window=null,launcherWindow=null,storeWindow=null,zapFastWindow=null,shuttingDown=false,localNonce='';
let updater=null,freeUpdater=null,updateCheck=null,appOpen=null;
let autoUpdateEnabled=true;
let launcherState=safeLauncherSnapshot({phase:'loading',version:app.getVersion(),message:'Inicializando canal de atualizações seguro.',signed:false,autoInstall:true});
if(!app.requestSingleInstanceLock())app.quit();
else app.on('second-instance',()=>{
 const action=secondInstanceAction({
  crmOpen:!!(window&&!window.isDestroyed()),
  launcherOpen:!!(launcherWindow&&!launcherWindow.isDestroyed())
 });
 if(action==='focus-crm'){window.show();window.focus();return;}
 if(action==='focus-launcher'){launcherWindow.show();launcherWindow.focus();return;}
 void app.whenReady().then(()=>openLauncherWindow()).catch(()=>{});
});
app.setAppUserModelId('br.com.w1capital.infinitum.killa');

async function loadPublicConfiguration(){
 const response=await fetch(CONFIG_ENDPOINT,{
  headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'error',
  cache:'no-store'
 });
 if(!response.ok)throw Error('A API do CRM não retornou configuração pública ('+response.status+').');
 const raw=await response.text();
 if(raw.length>2500)throw Error('Configuração pública excede tamanho permitido.');
 return validateDesktopConfig(JSON.parse(raw));
}
// A stable loopback origin keeps Supabase sessions and Qwen caches across restarts.
// Never silently switch ports on an existing installation.
async function stablePrivatePort(){
 const folder=app.getPath('userData');
 mkdirSync(folder,{recursive:true});
 const file=join(folder,'killa-loopback-port.json');
 let saved=null;
 try{
  const value=JSON.parse(readFileSync(file,'utf8'));
  if(Number.isInteger(value.port)&&value.port>=1024&&value.port<=65535)saved=value.port;
 }catch{}
 const chosen=await new Promise((resolve,reject)=>{
  const server=createServer();
  server.once('error',error=>reject(saved?
   Error('Porta da sessão local está em uso. Feche outro INFINITUM ou aplicativo que use essa porta.'):error));
  server.listen(saved||0,'127.0.0.1',()=>{
   const address=server.address();
   server.close(error=>error?reject(error):resolve(address.port));
  });
 });
 if(!saved)writeFileSync(file,JSON.stringify({port:chosen})+'\n',{mode:0o600,flag:'wx'});
 return chosen;
}
function serverEntrypoint(){
 const dir=app.isPackaged?join(process.resourcesPath,'app-server'):join(process.cwd(),'desktop','app-server');
 const path=join(dir,'server.js');
 if(!existsSync(path))throw Object.assign(Error('Servidor Next.js ausente. Instalação incompleta.'),{code:'DESKTOP_BUNDLE_INCOMPLETE'});
 if(!existsSync(join(dir,'node_modules','next','package.json')))
  throw Object.assign(Error('Dependências Next.js ausentes no instalador. Instale novamente uma versão corrigida.'),{code:'DESKTOP_BUNDLE_INCOMPLETE'});
 return {dir,path};
}
async function startLocalNext(){
 port=await stablePrivatePort();
 localNonce=randomBytes(24).toString('hex');
 const {dir,path}=serverEntrypoint();
 const env={...safeStandaloneEnvironment(desktopConfig,port),KILLA_LOCAL_NONCE:localNonce};
 nextProcess=spawn(process.execPath,[path],{
  cwd:dir,env,windowsHide:true,stdio:['ignore','ignore','pipe'],shell:false
 });
 let processFailed=false;
 nextProcess.once('error',()=>{processFailed=true});
 nextProcess.once('exit',()=>{processFailed=true});
 // Never forward the child's environment, JWTs, personal data or logs to a remote telemetry endpoint.
 nextProcess.stderr?.resume();
 for(let attempt=0;attempt<80;attempt++){
  if(processFailed)throw Error('O servidor local foi encerrado inesperadamente.');
  try{
   const response=await fetch('http://127.0.0.1:'+port+'/api/desktop/health',{
    signal:AbortSignal.timeout(700),redirect:'error',cache:'no-store'
   });
   if(response.ok){
    const answer=await response.json();
    if(answer?.ready===true&&answer?.nonce===localNonce)return;
    throw Error('Servidor local não corresponde ao aplicativo autenticado.');
   }
  }catch{}
  await sleep(300);
 }
 throw Error('O servidor local não ficou disponível na porta privada.');
}
function nextProcessIsAlive(){
 return !!nextProcess&&nextProcess.exitCode===null&&nextProcess.signalCode===null;
}
async function localNextIsReady(){
 if(!canReuseLocalServer({processAlive:nextProcessIsAlive(),port,nonce:localNonce}))return false;
 try{
  const response=await fetch('http://127.0.0.1:'+port+'/api/desktop/health',{
   signal:AbortSignal.timeout(1200),redirect:'error',cache:'no-store'
  });
  if(!response.ok)return false;
  const answer=await response.json();
  return answer?.ready===true&&answer?.nonce===localNonce;
 }catch{return false;}
}
function pushLauncher(changes){
 launcherState=safeLauncherSnapshot({...launcherState,...changes});
 if(launcherWindow&&!launcherWindow.isDestroyed())
  launcherWindow.webContents.send('launcher:state',launcherState);
 return launcherState;
}
function isTrustedLauncherEvent(event){
 return !!(launcherWindow&&!launcherWindow.isDestroyed()&&
  event?.sender===launcherWindow.webContents&&
  event?.senderFrame?.url===pathToFileURL(join(app.getAppPath(),'launcher.html')).href);
}
async function applyVerifiedUpdate(){
 if(!canInstallSignedUpdate(launcherState))return pushLauncher({
  message:'Nenhuma atualização autenticada disponível para instalação.'
 });
 if(freeUpdater){
  pushLauncher({phase:'installing',message:'Executando instalador verificado por assinatura Ed25519 da W1 Capital.'});
  try{
   await freeUpdater.install();
   app.quit();
  }catch{
   pushLauncher({phase:'error',downloaded:false,
    message:'A integridade do pacote falhou ou o Windows bloqueou a instalação. Nenhum arquivo novo foi autorizado.'});
  }
  return launcherState;
 }
 if(!updater)return pushLauncher({phase:'unsigned',message:'Atualizador não configurado.'});
 pushLauncher({phase:'installing',message:'Instalando atualização Windows assinada e validada.'});
 try{updater.quitAndInstall(false,true)}
 catch{pushLauncher({phase:'error',message:'Instalador bloqueado; versão anterior preservada.'})}
 return launcherState;
}
async function checkForSignedUpdates(){
 if(freeUpdater){
  if(updateCheck)return updateCheck;
  updateCheck=freeUpdater.check().then(async result=>{
   if(result.status==='downloaded'&&autoUpdateEnabled&&!window)
    await applyVerifiedUpdate();
  }).catch(()=>{
   pushLauncher({phase:'offline',downloaded:false,
    message:'Não foi possível autenticar uma release W1 Capital. Nenhum programa foi executado. Você pode abrir a versão instalada.'});
  }).finally(()=>{updateCheck=null});
  await updateCheck;
  return launcherState;
 }
 if(!updater||!launcherState.signed)return pushLauncher({
  phase:'unsigned',message:'Esta instalação piloto não recebe executáveis automaticamente. Abra apenas releases assinados.'
 });
 if(updateCheck)return updateCheck;
 pushLauncher({phase:'checking',message:'Consultando versões oficiais do GitHub Releases por HTTPS.'});
 updateCheck=updater.checkForUpdates().catch(()=>{
  pushLauncher({phase:'offline',message:'Não foi possível acessar o canal assinado. Você pode abrir a versão instalada.'});
 }).finally(()=>{updateCheck=null});
 await updateCheck;
 return launcherState;
}
async function setupSignedUpdater(){
 // Two independent trust paths:
 // 1) Free W1 Ed25519 signatures pinned in the executable plus SHA-512;
 // 2) Optional Windows Authenticode, only if a trusted publisher is configured.
 // Never check arbitrary main.zip or run a downloaded script.
 const markerFile=join(process.resourcesPath,'signed-updates.json');
 let freeConfig=null;
 try{freeConfig=JSON.parse(readFileSync(markerFile,'utf8'))}catch{}
 if(app.isPackaged&&process.platform==='win32'&&
    freeConfig?.enabled===true&&freeConfig.source==='w1-ed25519-github-release'){
  try{
   const pub=readFileSync(join(app.getAppPath(),'branding','update-public-key.pem'),'utf8');
   freeUpdater=createFreeUpdater({app,publicKey:pub,onState:pushLauncher});
   pushLauncher({phase:'ready',signed:true,autoInstall:autoUpdateEnabled,
    message:'Canal gratuito W1 Capital: verificações Ed25519 e SHA-512 ativadas.'});
   const interval=setInterval(()=>{void checkForSignedUpdates()},6*60*60*1000);
   interval.unref?.();
   await checkForSignedUpdates();
  }catch{
   freeUpdater=null;
   pushLauncher({phase:'unsigned',signed:false,
    message:'A identidade criptográfica de atualização não foi validada. Atualizações de EXE bloqueadas.'});
  }
  return;
 }
 // A writable marker by itself cannot grant updater access. The installed
 // app-update.yml must also contain the publisher's Authenticode identity.
 const marker=join(process.resourcesPath,'signed-updates.json');
 const updateManifest=join(process.resourcesPath,'app-update.yml');
 let config=null,manifest='';
 try{config=JSON.parse(readFileSync(marker,'utf8'))}catch{}
 try{manifest=readFileSync(updateManifest,'utf8')}catch{}
 const signed=process.platform==='win32'&&app.isPackaged&&
  isSignedUpdateConfiguration(config,manifest)&&
  shouldRunSignedUpdater({packaged:app.isPackaged,win32:true,signedMarker:config.enabled===true});
 if(!signed){
  pushLauncher({phase:'unsigned',signed:false,
   message:'Instalação de teste: atualização de executáveis desativada até existir uma versão assinada.'});
  return;
 }
 try{
  const module=await import('electron-updater');
  updater=module.autoUpdater||module.default?.autoUpdater;
  if(!updater)throw Error('Updater unavailable');
  updater.autoDownload=true;                // Download in background, verify Authenticode.
  updater.autoInstallOnAppQuit=false;        // Never install without visible user approval.
  updater.allowDowngrade=false;
  updater.allowPrerelease=false;
  updater.on('checking-for-update',()=>pushLauncher({
   phase:'checking',message:'Verificando atualizações oficiais e integridade do canal.'
  }));
  updater.on('update-available',info=>pushLauncher({
   phase:'downloading',downloaded:false,updateVersion:info?.version||'',
   percent:0,message:'Atualização assinada encontrada. Download em andamento; instalação requer confirmação.'
  }));
  updater.on('download-progress',progress=>pushLauncher({
   phase:'downloading',percent:normalizeUpdateProgress(progress),
   message:'Baixando pacote assinado e verificando metadados de integridade.'
  }));
  updater.on('update-downloaded',info=>pushLauncher({
   phase:'downloaded',downloaded:true,percent:100,updateVersion:info?.version||'',
   message:'Download concluído. O instalador somente será aplicado após verificar a assinatura do editor.'
  }));
  updater.on('update-not-available',()=>pushLauncher({
   phase:'ready',downloaded:false,percent:0,message:'Você já possui a versão publicada mais recente.'
  }));
  updater.on('error',()=>pushLauncher({
   phase:'offline',downloaded:false,
   message:'A atualização não foi validada. Nenhum executável foi instalado; a versão atual continua disponível.'
  }));
  await checkForSignedUpdates();
 }catch{
  updater=null;
  pushLauncher({phase:'offline',signed:false,downloaded:false,
   message:'Não foi possível inicializar o atualizador seguro. Nenhum pacote será instalado.'});
 }
}
async function openLauncherWindow(){
 if(launcherWindow&&!launcherWindow.isDestroyed()){
  launcherWindow.show();launcherWindow.focus();return;
 }
 launcherWindow=new BrowserWindow({
  width:950,height:710,minWidth:850,minHeight:610,
  backgroundColor:'#0b0a0f',show:false,autoHideMenuBar:true,
  title:'W1 Capital · Launcher Killa AI',
  webPreferences:{
   preload:join(app.getAppPath(),'launcher-preload.cjs'),
   contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,
   webviewTag:false,allowRunningInsecureContent:false
  }
 });
 launcherWindow.webContents.session.setPermissionRequestHandler((_sender,_permission,cb)=>cb(false));
 launcherWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 launcherWindow.webContents.on('will-navigate',e=>e.preventDefault());
 launcherWindow.on('closed',()=>{launcherWindow=null});
 await launcherWindow.loadFile(join(app.getAppPath(),'launcher.html'));
 launcherWindow.show();
 pushLauncher({version:app.getVersion()});
}
function expectTrustedLauncher(event){
 if(!isTrustedLauncherEvent(event))throw Object.assign(Error('Origem da operação não autorizada.'),{code:'LAUNCHER_NOT_TRUSTED'});
}
ipcMain.handle('launcher:get-state',event=>{
 expectTrustedLauncher(event);
 return launcherState;
});
ipcMain.handle('launcher:check-update',event=>{
 expectTrustedLauncher(event);
 return checkForSignedUpdates();
});
ipcMain.handle('launcher:open-downloads',async event=>{
 expectTrustedLauncher(event);
 await shell.openExternal('https://github.com/W1CAPITAL/Infinitum/releases');
 return launcherState;
});
ipcMain.handle('launcher:install-update',event=>{
 expectTrustedLauncher(event);
 return applyVerifiedUpdate();
});
ipcMain.handle('launcher:set-auto-update',(event,value)=>{
 expectTrustedLauncher(event);
 if(typeof value!=='boolean')throw Error('Configuração de atualização inválida.');
 autoUpdateEnabled=value;
 const prefs=join(app.getPath('userData'),'killa-launcher-preferences.json');
 writeFileSync(prefs,JSON.stringify({autoInstall:value})+'\n',{mode:0o600});
 pushLauncher({autoInstall:value,message:value
  ?'Instalação automática ativada apenas para releases W1 Capital autenticadas.'
  :'Instalação automática desligada; você pode atualizar manualmente no launcher.'});
 return launcherState;
});
// ZapFast is a separate, first-party HTTPS application. Its browser profile is
// isolated from the CRM's Supabase session; it does not share cookies or tokens.
async function openZapFastWindow(){
 if(zapFastWindow&&!zapFastWindow.isDestroyed()){
  zapFastWindow.show();zapFastWindow.focus();
  return {opened:true};
 }
 const target=new BrowserWindow({
  width:1150,height:790,minWidth:740,minHeight:520,
  show:false,backgroundColor:'#16101a',autoHideMenuBar:true,
  title:'W1 Capital · ZapFast WhatsApp',
  webPreferences:{
   partition:'persist:w1-zapfast',
   contextIsolation:true,nodeIntegration:false,sandbox:true,
   webSecurity:true,webviewTag:false,allowRunningInsecureContent:false
  }
 });
 zapFastWindow=target;
 target.webContents.session.setPermissionRequestHandler((_sender,_permission,done)=>done(false));
 target.webContents.setWindowOpenHandler(({url})=>{
  if(isSafeZapFastNavigation(url))void target.loadURL(url).catch(()=>{});
  return {action:'deny'};
 });
 target.webContents.on('will-navigate',(event,url)=>{
  if(!isSafeZapFastNavigation(url))event.preventDefault();
 });
 target.webContents.on('will-redirect',(event,url)=>{
  if(!isSafeZapFastNavigation(url))event.preventDefault();
 });
 target.on('closed',()=>{if(zapFastWindow===target)zapFastWindow=null});
 try{await target.loadURL(DESKTOP_ZAPFAST_URL)}
 catch{
  if(!target.isDestroyed())target.close();
  throw Error('ZapFast não abriu. Verifique o serviço HTTPS e a conexão com a internet.');
 }
 target.show();
 return {opened:true};
}
function isTrustedDesktopEvent(event){
 return !!(window&&!window.isDestroyed()&&event?.sender===window.webContents&&
  isLocalAppNavigation(event?.senderFrame?.url,port));
}
ipcMain.handle('killa:open-zapfast',event=>{
 if(!isTrustedDesktopEvent(event))throw Error('Origem do CRM não autorizada.');
 return openZapFastWindow();
});
ipcMain.handle('launcher:open-zapfast',event=>{
 expectTrustedLauncher(event);
 return openZapFastWindow();
});
// Independent W1 Capital Store runs entirely from signed, bundled HTML, not the CRM.
function isTrustedStoreEvent(event){
 return !!(storeWindow&&!storeWindow.isDestroyed()&&
  event?.sender===storeWindow.webContents&&
  event?.senderFrame?.url===pathToFileURL(join(app.getAppPath(),'store.html')).href);
}
async function openStoreWindow(){
 if(storeWindow&&!storeWindow.isDestroyed()){
  storeWindow.show();storeWindow.focus();return {opened:true};
 }
 const target=new BrowserWindow({
  width:1040,height:740,minWidth:780,minHeight:570,
  show:false,backgroundColor:'#110d16',autoHideMenuBar:true,
  title:'W1 Capital · Central de Aplicativos',
  webPreferences:{
   preload:join(app.getAppPath(),'store-preload.cjs'),
   contextIsolation:true,nodeIntegration:false,sandbox:true,
   webSecurity:true,webviewTag:false,allowRunningInsecureContent:false
  }
 });
 storeWindow=target;
 target.webContents.session.setPermissionRequestHandler((_sender,_permission,done)=>done(false));
 target.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 target.webContents.on('will-navigate',event=>event.preventDefault());
 target.on('closed',()=>{if(storeWindow===target)storeWindow=null});
 await target.loadFile(join(app.getAppPath(),'store.html'));
 target.show();
 return {opened:true};
}
ipcMain.handle('launcher:open-store',event=>{
 expectTrustedLauncher(event);
 return openStoreWindow();
});
ipcMain.handle('store:launch-infinitum',event=>{
 if(!isTrustedStoreEvent(event))throw Error('Janela da loja não autorizada.');
 return launchLocalCRM(DESKTOP_ENTRY_PATH);
});
ipcMain.handle('store:open-repo',async(event,product)=>{
 if(!isTrustedStoreEvent(event))throw Error('Janela da loja não autorizada.');
 const known={
  lexis:'https://github.com/W1CAPITAL/LexisPredict',
  infinitum:'https://github.com/W1CAPITAL/Infinitum/releases'
 };
 if(typeof product!=='string'||!Object.hasOwn(known,product))throw Error('Produto desconhecido.');
 await shell.openExternal(known[product]);
 return {opened:true};
});
async function launchLocalCRM(target=DESKTOP_ENTRY_PATH){
 if(window&&!window.isDestroyed()){
  if(target!==DESKTOP_ENTRY_PATH)await window.loadURL('http://127.0.0.1:'+port+target);
  window.show();window.focus();
  return launcherState;
 }
 if(appOpen){await appOpen;
  if(window&&target!==DESKTOP_ENTRY_PATH)await window.loadURL('http://127.0.0.1:'+port+target);
  return launcherState;
 }
 if(nextProcess){
  if(nextProcessIsAlive()){
   if(!await localNextIsReady())return pushLauncher({phase:'error',
    message:'O servidor local anterior ainda está ativo, mas não respondeu ao teste de segurança. Feche o INFINITUM e tente novamente.'});
   try{
    await openAppWindow(target);
    if(launcherWindow&&!launcherWindow.isDestroyed())launcherWindow.close();
    return launcherState;
   }catch{
    if(window&&!window.isDestroyed())window.close();
    return pushLauncher({phase:'error',
     message:'Não foi possível reabrir o INFINITUM. O servidor local permaneceu protegido.'});
   }
  }
  nextProcess=null;port=0;localNonce='';
 }
 appOpen=(async()=>{
  pushLauncher({phase:'opening',message:'Iniciando servidor local autorizado, sem Vercel.'});
  try{
   // Validate the on-disk Windows bundle BEFORE contacting Supabase.
   // A missing node_modules is a packaging error, not an authentication failure.
   serverEntrypoint();
   desktopConfig=await loadPublicConfiguration();
   await startLocalNext();
   await openAppWindow(target);
   if(launcherWindow&&!launcherWindow.isDestroyed())launcherWindow.close();
   return launcherState;
  }catch(error){
   if(nextProcess&&!nextProcess.killed){try{nextProcess.kill()}catch{}}
   nextProcess=null;
   const message=error?.code==='DESKTOP_BUNDLE_INCOMPLETE'
    ?'Instalação incompleta: dependências Next.js ausentes. Baixe e instale uma versão corrigida.'
    :desktopConfig===null
     ?'Não foi possível carregar a configuração pública do OpenBot pelo Supabase. Verifique a internet ou o serviço independente.'
     :'Servidor Next.js local não iniciou. Verifique o pacote e a porta local; nenhum dado de cliente foi exposto.';
   return pushLauncher({phase:'error',message});
  }finally{appOpen=null}
 })();
 return appOpen;
}
ipcMain.handle('launcher:launch',event=>{
 expectTrustedLauncher(event);
 return launchLocalCRM(DESKTOP_ENTRY_PATH);
});
ipcMain.handle('launcher:open-admin',event=>{
 expectTrustedLauncher(event);
 // A launcher button only navigates. The private Supabase Edge Function still
 // enforces the exclusive superadmin allowlist and MFA for every request.
 return launchLocalCRM('/app-store/admin');
});
async function openAppWindow(target=DESKTOP_ENTRY_PATH){
 window=new BrowserWindow({
  width:1300,height:840,minWidth:880,minHeight:600,
  show:false,backgroundColor:'#120c15',autoHideMenuBar:true,
  title:'INFINITUM · Killa AI',
  webPreferences:{
   preload:join(app.getAppPath(),'preload.cjs'),
   contextIsolation:true,nodeIntegration:false,sandbox:true,
   webSecurity:true,webviewTag:false,allowRunningInsecureContent:false
  }
 });
 window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 window.webContents.setWindowOpenHandler(({url})=>{
  if(isSafeExternalNavigation(url))void shell.openExternal(url);
  return {action:'deny'};
 });
 window.webContents.on('will-navigate',(event,target)=>{
  if(isLocalAppNavigation(target,port))return;
  event.preventDefault();
  if(isSafeExternalNavigation(target))void shell.openExternal(target);
 });
 window.on('closed',()=>{window=null});
 await window.loadURL('http://127.0.0.1:'+port+target);
 window.show();
}
function cleanup(){
 if(shuttingDown)return;
 shuttingDown=true;
 if(nextProcess&&!nextProcess.killed){
  try{nextProcess.kill()}catch{}
 }
}
ipcMain.on('killa:public-config',event=>{
 // The exposed value is only the public Supabase URL / anon key.
 event.returnValue=desktopConfig?
  {supabaseUrl:desktopConfig.supabaseUrl,publishableKey:desktopConfig.publishableKey}:null;
});
app.on('before-quit',cleanup);
app.on('window-all-closed',()=>{
 if(process.platform==='darwin')return;
 if(autoUpdateEnabled&&freeUpdater&&launcherState.phase==='downloaded'){
  // Keep main process alive until the authenticated installer is launched.
  void applyVerifiedUpdate().finally(()=>app.quit());
  return;
 }
 app.quit();
});
app.whenReady().then(async()=>{
 Menu.setApplicationMenu(null);
 try{
  const prefs=JSON.parse(readFileSync(join(app.getPath('userData'),'killa-launcher-preferences.json'),'utf8'));
  autoUpdateEnabled=prefs?.autoInstall!==false;
 }catch{autoUpdateEnabled=true}
 pushLauncher({autoInstall:autoUpdateEnabled});
 try{
  await openLauncherWindow();
  void setupSignedUpdater();
 }catch(error){
  dialog.showErrorBox('INFINITUM · launcher seguro',
   String(error?.message||'Falha ao iniciar o launcher local.').slice(0,240));
  app.quit();
 }
}).catch(()=>app.quit());
