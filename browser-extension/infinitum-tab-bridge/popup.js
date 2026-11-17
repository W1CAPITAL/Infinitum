const CHANNEL='INFINITUM_BROWSER_TAB_BRIDGE';
const notice=document.getElementById('notice'),tabsBox=document.getElementById('tabs');
const grantButton=document.getElementById('grant');
const ask=action=>chrome.runtime.sendMessage({channel:CHANNEL,...action});
async function refresh(){
 try{
  const [tabsResult,state]=await Promise.all([ask({action:'tabs'}),ask({action:'status'})]);
  tabsBox.replaceChildren();
  const tabs=Array.isArray(tabsResult.tabs)?tabsResult.tabs:[];
  if(!tabs.length){notice.textContent='Abra https://web.whatsapp.com no Chrome e faça login normalmente.';grantButton.disabled=true;return;}
  tabs.forEach((tab,i)=>{
   const label=document.createElement('label');
   const input=document.createElement('input');input.type='radio';input.name='tab';
   input.value=String(tab.id);input.checked=tab.id===state.tabId||!state.authorized&&i===0;
   input.onchange=()=>{grantButton.disabled=false};
   const name=document.createElement('span');name.textContent=tab.title||'WhatsApp Web';
   label.append(input,name);tabsBox.append(label);
  });
  grantButton.disabled=false;
  notice.textContent=state.authorized?'Aba autorizada. Acesse o INFINITUM pelo domínio principal.':
   'WhatsApp Web aberto. Selecione a aba e autorize.';
 }catch{notice.textContent='Não foi possível verificar o navegador.'}
}
grantButton.onclick=async()=>{
 grantButton.disabled=true;
 const selected=document.querySelector('input[name="tab"]:checked');
 if(!selected){notice.textContent='Selecione uma aba WhatsApp Web.';return}
 const result=await ask({action:'grant',tabId:Number(selected.value)}).catch(()=>null);
 notice.textContent=result?.ok?'Aba conectada ao INFINITUM por uma hora.':'Falha ao autorizar esta aba.';
 await refresh();
};
document.getElementById('revoke').onclick=async()=>{
 await ask({action:'revoke'}).catch(()=>{});
 notice.textContent='Acesso revogado. Nenhum envio realizado.';
 await refresh();
};
refresh();
