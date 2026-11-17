const {contextBridge,ipcRenderer}=require('electron');
// Synchronous at startup: no arbitrary filesystem, commands, network access or tokens.
const publicConfig=ipcRenderer.sendSync('killa:public-config');
contextBridge.exposeInMainWorld('killaDesktopPublicConfig',
 Object.freeze(publicConfig&&typeof publicConfig==='object'?{
  supabaseUrl:publicConfig.supabaseUrl,publishableKey:publicConfig.publishableKey
 }:{}));

// Only the trusted local CRM renderer can open the dedicated ZapFast window.
contextBridge.exposeInMainWorld('killaDesktop',Object.freeze({
 openZapFast:()=>ipcRenderer.invoke('killa:open-zapfast')
}));
