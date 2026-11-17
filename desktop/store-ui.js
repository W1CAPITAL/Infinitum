'use strict';
const bridge=window.w1Store;
const status=document.getElementById('store-status');
function connect(id,action){
 const button=document.getElementById(id);
 if(!button)return;
 button.addEventListener('click',async()=>{
  if(!bridge){status.textContent='Loja não autenticada pelo executável.';return}
  button.disabled=true;
  try{
   const result=await action();
   status.textContent=result?.opened===true?'Solicitação aberta pelo Windows.':'Operação concluída.';
  }catch{
   status.textContent='Não foi possível abrir o destino. O aplicativo instalado não foi alterado.';
  }finally{button.disabled=false}
 });
}
connect('open-infinitum',()=>bridge.launchInfinitum());
connect('lexis-repository',()=>bridge.openRepository('lexis'));
connect('infinitum-releases',()=>bridge.openRepository('infinitum'));
if(!bridge)status.textContent='Ponte segura do EXE indisponível.';
