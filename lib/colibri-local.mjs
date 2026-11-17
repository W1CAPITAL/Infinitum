import {LOCAL_QWEN_RUNTIME,selectLocalQwenBackend} from './local-qwen-runtime.mjs';
// This is a browser-side control router, not the native JustVugg/colibri.
// Qwen runs in a dedicated Web Worker (GPU if possible, else CPU/WebAssembly).
export const COLIBRI_LOCAL_POLICY=Object.freeze({
 free:true,needsServer:false,requiresWebGpu:false,minimumMemoryGb:4,
 maxNewTokens:LOCAL_QWEN_RUNTIME.maxTokens,
 cacheRole:'weights_only',maxParallelModels:1,writesWhatsApp:false,sharesDataWithAIProvider:false
});
export function planColibriLocal({prompt='',allowLocalModel=false,device={},modelId=LOCAL_QWEN_RUNTIME.model}={}){
 const backend=selectLocalQwenBackend({...device,modelId});
 const useQwen=allowLocalModel&&backend.ok;
 return {
  engine:useQwen?'qwen':'rules',device:useQwen?backend.device:null,
  offlineInference:true,offline:true,needsServer:false,autoSend:false,
  requiresReview:true,modelDownloadRequiresConsent:true,
  maxNewTokens:COLIBRI_LOCAL_POLICY.maxNewTokens,
  reason:!allowLocalModel?'model_not_authorized':!backend.ok?'hardware_not_safe':'qwen_preferred',
  notice:backend.reason
 };
}
