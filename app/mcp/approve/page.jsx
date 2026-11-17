'use client';
import {useEffect,useState} from 'react';
import {useWorkspaceSession} from '../../../components/workspace-session-provider.jsx';
const EDGE='https://ulkuhiibeoibbzhqrfya.supabase.co/functions/v1/killa-mcp/approve';
export default function KillaMcpApproval(){
 const {db,session,loading}=useWorkspaceSession();
 const [intents,setIntents]=useState([]),[mfa,setMfa]=useState(false);
 const [busy,setBusy]=useState(''),[notice,setNotice]=useState('');
 const [requestId,setRequestId]=useState('');
 useEffect(()=>{setRequestId(new URLSearchParams(window.location.search).get('requestId')||'')},[]);
 useEffect(()=>{
  if(!db||!session?.user?.id)return;
  let active=true;
  (async()=>{
   const [aal,pending]=await Promise.all([
    db.auth.mfa.getAuthenticatorAssuranceLevel(),
    db.from('killa_mcp_send_intents')
     .select('id,jid,message,client_id,status,expires_at,created_at')
     .eq('owner_id',session.user.id).eq('status','pending')
     .order('created_at',{ascending:false}).limit(12)
   ]);
   if(!active)return;
   if(aal.error||pending.error)throw Error('Não foi possível verificar solicitações com segurança.');
   setMfa(aal.data?.currentLevel==='aal2');
   setIntents(pending.data||[]);
  })().catch(e=>{if(active)setNotice(String(e.message||e))});
  return()=>{active=false};
 },[db,session?.user?.id]);
 async function approve(id){
  if(busy||!mfa||!session?.user?.id)return;
  setBusy(id);setNotice('');
  try{
   const intent=intents.find(x=>x.id===id);
   if(!intent||intent.status!=='pending'||Date.parse(intent.expires_at)<=Date.now())
    throw Error('Solicitação não está mais disponível.');
   const auth=await db.auth.getSession();
   if(auth.data.session?.user?.id!==session.user.id||!auth.data.session?.access_token)
    throw Error('Sessão de atendimento inválida.');
   const res=await fetch(EDGE,{method:'POST',cache:'no-store',
    headers:{Authorization:'Bearer '+auth.data.session.access_token,'Content-Type':'application/json'},
    body:JSON.stringify({requestId:id,confirm:true})});
   const data=await res.json();
   if(!res.ok||!data.ok)throw Error(data.error||'Envio não confirmado.');
   setIntents(old=>old.filter(x=>x.id!==id));
   setNotice(data.status==='accepted'
    ?'WA.Auto aceitou o envio. Entrega e leitura não foram confirmadas.'
    :'O resultado do envio ficou incerto. Não tente reenviar sem verificar o WhatsApp.');
  }catch(e){setNotice(String(e.message||e).slice(0,200))}
  finally{setBusy('')}
 }
 return <main style={{maxWidth:720,margin:'4vh auto',padding:24}}>
  <div style={{background:'linear-gradient(140deg,#341528,#130f19)',border:'1px solid #865873',
    borderRadius:20,padding:25,color:'#f5eef3'}}>
   <h1>Killa AI · autorizar atendimento</h1>
   <p>Veja exatamente quem receberá a mensagem antes de autorizar. Cada solicitação vale por cinco minutos e só pode ser enviada uma vez.</p>
   {loading?<p>Validando sessão...</p>:!session?.user?<p>Entre na sua conta INFINITUM para continuar.</p>:<>
    {!mfa&&<p role="alert" style={{color:'#ffc0c0'}}>Confirme o segundo fator (MFA/AAL2) no login antes de aprovar envios.</p>}
    {!intents.length&&<p>Não há solicitações pendentes neste usuário.</p>}
    {intents.filter(x=>!requestId||x.id===requestId).map(item=>
     <article key={item.id} style={{border:'1px solid #705169',borderRadius:14,padding:17,margin:'16px 0',background:'#201723'}}>
      <div style={{fontSize:12,color:'#c5acbe'}}>Aplicativo autorizado: {item.client_id}</div>
      <p>Destino: <strong>{item.jid.split('@')[0]}</strong></p>
      <p style={{whiteSpace:'pre-wrap',lineHeight:1.6,padding:14,borderRadius:10,background:'#110e14'}}>{item.message}</p>
      <p>Expira: {new Date(item.expires_at).toLocaleString('pt-BR')}</p>
      <button type="button" disabled={!mfa||!!busy||Date.parse(item.expires_at)<=Date.now()}
       onClick={()=>approve(item.id)} style={{padding:'12px 17px',border:0,borderRadius:11,
        background:'#a73d70',color:'white',cursor:'pointer'}}>
       {busy===item.id?'Confirmando…':'Confirmar envio desta mensagem'}
      </button>
     </article>)}
   </>}
   {notice&&<p role="status">{notice}</p>}
   <p style={{color:'#cbbec7',fontSize:12}}>O MCP não recebe a senha do funcionário nem obtém permissão geral de envio. Este é um ato do operador autenticado.</p>
  </div>
 </main>;
}
