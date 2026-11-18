export const RELAY_ORIGIN='https://predictbot-opencode.daviconcentrix.workers.dev';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION=/^ses[a-zA-Z0-9_-]{1,180}$/;
const own=(x,name)=>Object.prototype.hasOwnProperty.call(x,name);
export function remoteRelayRequest(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['action','jobId','deviceId','operation','key','input'].includes(k)))throw Error('Solicitação da ponte inválida.');
 if(value.action==='devices'&&Object.keys(value).length===1)return {method:'GET',path:'/v1/devices',body:null};
 if(value.action==='task'&&Object.keys(value).length===2&&UUID.test(value.jobId||''))return {method:'POST',path:'/v1/task',body:{jobId:value.jobId}};
 if(value.action!=='submit'||Object.keys(value).some(k=>!['action','deviceId','operation','key','input'].includes(k))||!UUID.test(value.deviceId||'')||!UUID.test(value.key||''))throw Error('Operação da ponte não autorizada.');
 const input=value.input;
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Dados da tarefa inválidos.');
 let args;
 if(value.operation==='create'&&Object.keys(input).every(k=>k==='title')&&typeof input.title==='string'&&input.title.length>0&&input.title.length<=200)args={title:input.title};
 if(value.operation==='prompt'&&Object.keys(input).every(k=>['sessionId','text'].includes(k))&&SESSION.test(input.sessionId||'')&&typeof input.text==='string'&&input.text.trim().length>0&&input.text.length<=32000)args={sessionId:input.sessionId,text:input.text};
 if(value.operation==='messages'&&Object.keys(input).length===1&&SESSION.test(input.sessionId||''))args={sessionId:input.sessionId};
 if(!args)throw Error('Tipo de tarefa OpenCode não autorizado.');
 return {method:'POST',path:'/v1/jobs',body:{deviceId:value.deviceId,operation:value.operation,input:args,key:value.key}};
}
