import {officeAuth,officeJson,safeOfficeError} from '../../../../lib/office-server.mjs';
import {configuredLexisMotors} from '../../../../lib/lexis-motor-cascade.mjs';
import {predictLmConfig} from '../../../../lib/predictlm-gateway.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const labels={colibri:'Colibri',minicpm:'MiniCPM',minimax:'MiniMax',claude:'Claude',groq:'Groq',xai:'Grok (xAI)',openrouter:'OpenRouter',gemini:'Gemini'};
export async function GET(request){
 try{
  await officeAuth(request);
  // Only report real server configuration; never serialize credentials or endpoints.
  const providers=configuredLexisMotors(process.env).map(x=>({id:x.id,label:labels[x.id]||x.id,model:x.model,mode:'online'}));
  if(predictLmConfig(process.env))providers.push({id:'predictlm',label:'PredictLM',model:'Servidor configurado',mode:'online'});
  return officeJson({ok:true,models:[
   {id:'rules',label:'Rascunho rápido (sem IA generativa)',model:'Regras locais',mode:'rules'},
   ...(providers.length?[{id:'auto',label:'Automático (somente modelos configurados)',model:'Roteamento disponível',mode:'online'}]:[]),
   ...providers,{id:'qwen',label:'Qwen 0,5B (navegador, opcional)',model:'Qwen local',mode:'local'}],
   hasOnline:providers.length>0,onlineCount:providers.length,
   notice:'Disponibilidade indica configuração, não garante resposta. Não expõe chaves nem conecta WhatsApp.'});
 }catch(e){return safeOfficeError(e)}
}
