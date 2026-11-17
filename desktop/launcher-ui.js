'use strict';
const ids={installed:document.getElementById('installed-version'),title:document.getElementById('state-title'),
 message:document.getElementById('state-message'),light:document.getElementById('state-light'),
 bar:document.getElementById('progress-block'),fill:document.getElementById('progress-fill'),
 progress:document.getElementById('progress-text'),install:document.getElementById('install-update'),
 launch:document.getElementById('launch'),check:document.getElementById('check'),
 releases:document.getElementById('releases'),admin:document.getElementById('admin-diagnostics'),
 store:document.getElementById('store'),zapfast:document.getElementById('zapfast'),auto:document.getElementById('auto-updates')};
const TITLES={loading:'Iniciando launcher',checking:'Buscando atualização segura',
 ready:'Aplicativo atualizado',available:'Atualização disponível',
 downloading:'Baixando atualização',downloaded:'Atualização pronta para instalar',
 installing:'Instalando e reiniciando',opening:'Iniciando o INFINITUM',
 unsigned:'Instalação piloto sem assinatura',offline:'Sem conexão para atualizar',
 error:'Não foi possível verificar a atualização'};
function render(value){
 if(!value||typeof value!=='object')return;
 const phase=String(value.phase||'error'),percent=Number(value.percent)||0;
 ids.installed.textContent='Versão instalada: '+String(value.version||'0.0.0');
 if(ids.auto)ids.auto.checked=value.autoInstall!==false;
 ids.title.textContent=TITLES[phase]||TITLES.error;
 ids.message.textContent=String(value.message||'');
 ids.light.className='state-indicator'+(['ready','downloaded'].includes(phase)?' ok':phase==='error'?' fail':'');
 ids.bar.hidden=phase!=='downloading';
 ids.fill.style.width=Math.max(0,Math.min(100,percent))+'%';
 ids.progress.textContent=Math.floor(Math.max(0,Math.min(100,percent)))+'%';
 ids.install.hidden=phase!=='downloaded'||value.signed!==true||value.downloaded!==true;
 ids.install.disabled=phase==='installing';
 ids.launch.disabled=['installing','opening'].includes(phase);
 ids.check.disabled=['checking','downloading','installing','opening'].includes(phase)||value.signed!==true;
}
function connect(id,api,{renderResult=true}={}){
 ids[id].addEventListener('click',async()=>{
  ids[id].disabled=true;
  try{const result=await api();if(renderResult&&result&&typeof result==='object')render(result)}
  catch{
   ids.message.textContent='Operação não concluída. Confira a instalação ou conexão.';
  }finally{if(id!=='install'&&id!=='launch')ids[id].disabled=false}
 });
}
const bridge=window.killaLauncher;
if(bridge){
 bridge.onState(render);
 bridge.getState().then(render).catch(()=>{ids.title.textContent='Falha ao inicializar'});
 connect('check',bridge.check);
 connect('launch',bridge.launch);
 connect('install',bridge.install);
 connect('releases',bridge.releases);
 connect('admin',bridge.openAdmin);
 connect('store',bridge.openStore);
 connect('zapfast',bridge.openZapFast,{renderResult:false});
 if(ids.auto)ids.auto.addEventListener('change',()=>bridge.setAutoUpdate(ids.auto.checked).then(render).catch(()=>{ids.auto.checked=!ids.auto.checked}));
}else{ids.message.textContent='Instalação inválida: ponte segura indisponível.'}
