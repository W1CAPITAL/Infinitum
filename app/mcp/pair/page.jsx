'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import SecuredWorkspace from '../../../components/secured-workspace.jsx';
function PairView({db,session}){
 const [connection,setConnection]=useState(null),[qrImage,setQrImage]=useState('');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const statusPollingEnabled=useRef(true);
 const refresh=useCallback(async()=>{
  const {data:{session:auth}}=await db.auth.getSession();
  if(!auth?.access_token)throw Error('Entre novamente no INFINITUM.');
  const res=await fetch('/api/office/whatsapp/bridge?action=status',{
   headers:{Authorization:'Bearer '+auth.access_token},cache:'no-store'});
  const data=await res.json();
  if(!res.ok||data.ok===false){statusPollingEnabled.current=false;throw Error(String(data.error||'Não foi possível consultar a conexão individual.').slice(0,240));}
  statusPollingEnabled.current=data.configured===true;
  setConnection(data);
  return data;
 },[db]);
 useEffect(()=>{
  let active=true;
  refresh().catch(e=>{if(active)setNotice(e.message)});
  const clock=window.setInterval(()=>{
   if(document.visibilityState==='visible'&&active&&statusPollingEnabled.current)
    refresh().catch(e=>{if(active)setNotice(String(e?.message||'Conexão indisponível.').slice(0,240))});
  },4000);
  return()=>{active=false;window.clearInterval(clock)};
 },[refresh]);
 const qr=connection?.connection?.qr||'';
 useEffect(()=>{
  let active=true;
  if(connection?.connected||!qr){setQrImage('');return}
  if(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(qr)){
   setQrImage(qr);return;
  }
  import('qrcode').then(qrcode=>qrcode.default.toDataURL(String(qr),{
   width:260,margin:2,errorCorrectionLevel:'M'
  })).then(x=>{if(active)setQrImage(x)}).catch(()=>{if(active)setQrImage('')});
  return()=>{active=false};
 },[qr,connection?.connected]);
 async function connect(){
  if(busy)return;
  setBusy(true);setNotice('');
  try{
   const {data:{session:auth}}=await db.auth.getSession();
   if(auth?.user?.id!==session.user.id||!auth.access_token)throw Error('Sessão inválida.');
   const res=await fetch('/api/office/whatsapp/bridge',{method:'POST',cache:'no-store',
    headers:{Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},
    body:JSON.stringify({action:'connect'})});
   const result=await res.json();
   if(!res.ok||result.ok===false)throw Error(String(result.error||'Falha ao iniciar conexão.').slice(0,160));
   await refresh();
   setNotice('Conexão solicitada. O QR é exibido somente nesta página privada.');
  }catch(e){setNotice(String(e.message||e).slice(0,160))}
  finally{setBusy(false)}
 }
 return <section style={{maxWidth:520,margin:'4rem auto',padding:24}}>
  <h1>Killa AI · conectar seu WhatsApp</h1>
  <p>Esta sessão pertence somente ao usuário autenticado no INFINITUM. Nenhuma IA recebe o QR, a chave ou o código de pareamento.</p>
  <p role="status">{connection?.connected?'WhatsApp conectado à sua conta.':
   connection?.configured?'Aguardando conexão do seu WhatsApp.':
   connection?.message||'WA.Auto não configurado para esta conta.'}</p>
  {!connection?.configured&&<button type="button" onClick={()=>refresh().catch(e=>setNotice(e.message))}>Reverificar servidor WA.Auto</button>}
  {!connection?.connected&&qrImage&&<figure>
   <img src={qrImage} alt="QR Code individual de vinculação ao WhatsApp" width={260} height={260}/>
   <figcaption>WhatsApp no celular → Aparelhos conectados → Conectar um aparelho.</figcaption>
  </figure>}
  {!connection?.connected&&connection?.configured&&
   <button type="button" onClick={connect} disabled={busy}>
    {busy?'Conectando…':'Gerar ou atualizar QR Code'}
   </button>}
  {notice&&<p role="alert">{notice}</p>}
 </section>;
}
export default function KillaMcpPairPage(){
 return <SecuredWorkspace active="WhatsApp">{({db,session})=>
  <PairView key={session.user.id} db={db} session={session}/>}</SecuredWorkspace>;
}
