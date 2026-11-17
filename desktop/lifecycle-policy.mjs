const PORT_MIN=1024,PORT_MAX=65535;
const NONCE=/^[a-f0-9]{48}$/;

export function secondInstanceAction({crmOpen=false,launcherOpen=false}={}){
 if(crmOpen)return 'focus-crm';
 if(launcherOpen)return 'focus-launcher';
 return 'open-launcher';
}

export function canReuseLocalServer({processAlive=false,port=0,nonce=''}={}){
 return processAlive===true&&Number.isInteger(port)&&port>=PORT_MIN&&port<=PORT_MAX
  &&typeof nonce==='string'&&NONCE.test(nonce);
}
