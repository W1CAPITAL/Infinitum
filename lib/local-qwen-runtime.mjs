// Lightweight Qwen runtime planning. CPU/WebAssembly works without a server,
// although this does not make CPU inference fast or low-memory by itself.
export const LOCAL_QWEN_MODELS=Object.freeze({
 'onnx-community/Qwen2.5-0.5B-Instruct':Object.freeze({label:'Qwen 0.5B',minMemoryGb:4,requiresWebGpu:false}),
 'onnx-community/Qwen3-1.7B-ONNX':Object.freeze({label:'Qwen3 1.7B',minMemoryGb:8,requiresWebGpu:false}),
 'onnx-community/Qwen3-4B-ONNX':Object.freeze({label:'Qwen3 4B',minMemoryGb:8,requiresWebGpu:true})
});
export function resolveLocalQwenModel(engine){
 return engine==='qwen17'?'onnx-community/Qwen3-1.7B-ONNX':
  engine==='qwen4'?'onnx-community/Qwen3-4B-ONNX':'onnx-community/Qwen2.5-0.5B-Instruct';
}
export const LOCAL_QWEN_RUNTIME=Object.freeze({
 model:'onnx-community/Qwen2.5-0.5B-Instruct',quantization:'q4',
 defaultTokens:384,maxTokens:2048,dailyTokenLimit:null,dailyRequestLimit:null,minKnownCpuMemoryGb:4,concurrentModels:1,
 externalInference:false
});
export function normalizeLocalTokenBudget(input){
 const n=Number(input);
 return Number.isFinite(n)?Math.max(32,Math.min(LOCAL_QWEN_RUNTIME.maxTokens,Math.round(n))):LOCAL_QWEN_RUNTIME.defaultTokens;
}
export function selectLocalQwenBackend({webgpu=false,memoryGb=0,preferCpu=true,modelId=LOCAL_QWEN_RUNTIME.model}={}){
 const known=Number(memoryGb),gpu=webgpu===true&&!preferCpu;
 const spec=LOCAL_QWEN_MODELS[modelId];
 if(!spec)return {ok:false,device:'none',reason:'Modelo local não permitido.'};
 if(spec.requiresWebGpu&&!gpu)return {ok:false,device:'none',reason:'Qwen3 4B exige WebGPU ativado; execução em CPU bloqueada.'};
 if(modelId!==LOCAL_QWEN_RUNTIME.model&&known<spec.minMemoryGb)
  return {ok:false,device:'none',reason:'Qwen3 precisa de pelo menos '+spec.minMemoryGb+' GB de memória informada pelo navegador.'};
 // A missing hardware report is not a low-memory report.
 if(known>0&&known<4&&!gpu)return {
  ok:false,device:'none',reason:'O navegador informa menos de 4 GB de memória. Este modelo pode travar a CPU; mantenha o motor leve ou utilize um aparelho com mais RAM.'
 };
 return {ok:true,device:gpu?'webgpu':'wasm',reason:gpu?
  'Qwen executado na GPU do navegador.':'Qwen executado na CPU via WebAssembly; pode ser lento em PCs fracos.'};
}
