const ACTIONS=new Set(['launch','check-update','install-update','open-downloads']);
const PHASES=new Set(['loading','checking','ready','available','downloading','downloaded','installing','opening','error','unsigned','offline']);
const VERSION=/^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.-]{1,40})?$/;
export function validateLauncherAction(action){return typeof action==='string'&&ACTIONS.has(action)}
export function normalizeUpdateProgress(progress){
 const raw=Number(progress?.percent);
 return Number.isFinite(raw)?Math.max(0,Math.min(100,Math.floor(raw))):0;
}
export function safeLauncherSnapshot(input={}){
 const phase=PHASES.has(input?.phase)?input.phase:'error';
 return Object.freeze({
  phase,version:VERSION.test(String(input?.version||''))?String(input.version):'0.0.0',
  updateVersion:VERSION.test(String(input?.updateVersion||''))?String(input.updateVersion):'',
  percent:normalizeUpdateProgress({percent:input?.percent}),
  signed:input?.signed===true,downloaded:input?.downloaded===true,autoInstall:input?.autoInstall!==false,
  message:typeof input?.message==='string'?input.message.replace(/[<>]/g,'').slice(0,240):''
 });
}
export function canInstallSignedUpdate(input={}){
 return input?.signed===true&&input?.downloaded===true&&input?.phase==='downloaded';
}
export function isSignedUpdateConfiguration(config,manifest){
 return config?.enabled===true&&config?.source==='signed-github-release'&&
  typeof manifest==='string'&&
  /(?:^|\n)publisherName:\s*(?:\S+|\n\s*-\s*\S+)/m.test(manifest)&&
  !/(?:^|\n)verifyUpdateCodeSignature:\s*false\b/m.test(manifest);
}
