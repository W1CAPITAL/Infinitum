const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('w1Store',Object.freeze({
 launchInfinitum:()=>ipcRenderer.invoke('store:launch-infinitum'),
 openRepository:key=>ipcRenderer.invoke('store:open-repo',key)
}));
