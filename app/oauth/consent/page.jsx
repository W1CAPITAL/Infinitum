'use client';
import {useEffect,useState} from 'react';
import {useWorkspaceSession} from '../../../components/workspace-session-provider.jsx';

const SHARED_LEXIS_DB=process.env.NEXT_PUBLIC_LEXIS_SHARED_DB==='1';

async function approvedClientsForUser(db,userId){
 // Include explicit OpenBot/MausBot grants alongside the legacy Killa/INFINITUM MCP list.
 const modern=await db.from('openbot_mcp_grants').select('client_id')
  .eq('owner_id',userId).eq('enabled',true).gt('expires_at',new Date().toISOString()).limit(60);
 const modernIds=modern.error?[]:(modern.data||[]).map(x=>x.client_id);

 if(SHARED_LEXIS_DB){
  const member=await db.from('usuarios').select('empresa_id').eq('auth_user_id',userId).limit(2);
  if(member.error||member.data?.length!==1||!member.data[0]?.empresa_id)
   throw Error('Não foi possível confirmar a empresa vinculada à conta.');
  const settings=await db.from('office_agent_company_policies').select('config')
   .eq('empresa_id',member.data[0].empresa_id).limit(1).maybeSingle();
  if(settings.error)return modernIds; // New OpenBot grants do not depend on legacy policies.
  const config=settings.data?.config||{};
  return [...new Set([...modernIds,...(config.mcp_enabled===true&&Array.isArray(config.mcp_allowed_client_ids)?config.mcp_allowed_client_ids:[])])];
 }
 const settings=await db.from('killa_mcp_settings').select('mcp_enabled,allowed_client_ids')
  .eq('owner_id',userId).maybeSingle();
 if(settings.error)return modernIds;
 return [...new Set([...modernIds,...(settings.data?.mcp_enabled===true&&Array.isArray(settings.data?.allowed_client_ids)?settings.data.allowed_client_ids:[])])];
}

async function recordMfaGrant(db,authorizationId,clientId,userId){
 if(clientId&&userId){
  const modern=await db.from('openbot_mcp_grants').select('id')
   .eq('owner_id',userId).eq('client_id',clientId).eq('enabled',true)
   .gt('expires_at',new Date().toISOString()).maybeSingle();
  // The new MCP checks its own time-limited grant on every tool request.
  if(!modern.error&&modern.data)return {ok:true};
 }

 const {data,error}=await db.rpc('killa_record_mcp_mfa_grant',{p_authorization_id:authorizationId});
 if(error||data?.ok!==true)
  throw Error(error?.message||data?.error||'Não foi possível registrar a confirmação MFA desta conexão.');
 return data;
}

export default function KillaOAuthConsent(){
 const {db,session,loading}=useWorkspaceSession();
 const [authorizationId,setAuthorizationId]=useState('');
 const [approvedClients,setApprovedClients]=useState([]),[mfaOk,setMfaOk]=useState(false);
 const [confirmNewClient,setConfirmNewClient]=useState(false);
 const [allowReviewedEdits,setAllowReviewedEdits]=useState(false);
 const [mfaFactorId,setMfaFactorId]=useState(''),[mfaCode,setMfaCode]=useState('');
 const [pendingRedirect,setPendingRedirect]=useState('');
 const [details,setDetails]=useState(null),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[mfaBusy,setMfaBusy]=useState(false);
 useEffect(()=>{
  const id=new URLSearchParams(window.location.search).get('authorization_id')||'';
  setAuthorizationId(id);
  if(!id||!db||!session?.user||!db.auth?.oauth?.getAuthorizationDetails)return;
  let live=true;
  Promise.all([
   db.auth.oauth.getAuthorizationDetails(id),
   approvedClientsForUser(db,session.user.id),
   db.auth.mfa.getAuthenticatorAssuranceLevel(),
   db.auth.mfa.listFactors()
  ]).then(async([authorization,clients,mfa,factors])=>{
   if(!live)return;
   const {data,error}=authorization;
   if(mfa.error||factors.error){
    setNotice('Não foi possível verificar o segundo fator. Nenhum cliente será autorizado.');
    return;
   }
   setApprovedClients(clients);
   const verifiedFactor=(factors.data?.totp||[]).find(x=>x.status==='verified');
   setMfaFactorId(verifiedFactor?.id||'');
   const verified=mfa.data?.currentLevel==='aal2';
   setMfaOk(verified);
   if(error){setNotice(error.message);return;}
   if(data?.redirect_url&&!data?.authorization_id){
    setDetails(data);
    setPendingRedirect(data.redirect_url);
    if(verified){
     try{
      if(SHARED_LEXIS_DB)await recordMfaGrant(db,id,String(data?.client?.id||data?.client_id||''),session.user.id);
      if(live)window.location.assign(data.redirect_url);
     }catch(e){if(live)setNotice(String(e?.message||e).slice(0,230))}
    }else{
     setNotice('Este aplicativo já tinha autorização anterior. Confirme novamente seu segundo fator para continuar.');
    }
   }else setDetails(data);
  }).catch(e=>{if(live)setNotice(String(e?.message||'Não foi possível verificar a solicitação OAuth.').slice(0,230))});
  return()=>{live=false};
 },[db,session?.user?.id]);
 const clientId=String(details?.client?.id||details?.client?.client_id||details?.client_id||'');
 const clientApproved=clientId.length>0&&approvedClients.includes(clientId)&&mfaOk;
 async function verifyMfa(){
  if(!db||!mfaFactorId||mfaBusy||!/^\d{6}$/.test(mfaCode))return;
  setMfaBusy(true);setNotice('');
  try{
   const result=await db.auth.mfa.challengeAndVerify({factorId:mfaFactorId,code:mfaCode});
   if(result.error)throw result.error;
   const assurance=await db.auth.mfa.getAuthenticatorAssuranceLevel();
   if(assurance.error||assurance.data?.currentLevel!=='aal2')
    throw Error('O Supabase ainda não confirmou o nível AAL2. Digite um código novo.');
   setMfaOk(true);setMfaCode('');
   if(pendingRedirect){
    if(SHARED_LEXIS_DB)await recordMfaGrant(db,authorizationId,clientId,session.user.id);
    window.location.assign(pendingRedirect);
   }else setNotice('Segundo fator confirmado. Agora você pode autorizar a leitura.');
  }catch(e){setNotice(String(e?.message||e).slice(0,230))}
  finally{setMfaBusy(false)}
 }
 async function decide(approved){
  if(!db?.auth?.oauth||!authorizationId||busy||(approved&&(!mfaOk||(!clientApproved&&!confirmNewClient))))return;
  setBusy(true);setNotice('');
  try{
   if(approved&&!clientApproved){
    if(!/^[a-zA-Z0-9._:-]{5,200}$/.test(clientId))throw Error('ID público OAuth inválido.');
    const grant=await db.from('openbot_mcp_grants').upsert({
     owner_id:session.user.id,client_id:clientId,enabled:true,
     edit_scope:allowReviewedEdits?'reviewed_edit':'read',
     approved_at:new Date().toISOString(),
     expires_at:new Date(Date.now()+30*86400000).toISOString()
    },{onConflict:'owner_id,client_id'});
    if(grant.error)throw Error('Não foi possível autorizar o cliente para leitura: '+grant.error.message);
   }
   if(approved&&SHARED_LEXIS_DB)await recordMfaGrant(db,authorizationId,clientId,session.user.id);
   const result=approved?
    await db.auth.oauth.approveAuthorization(authorizationId):
    await db.auth.oauth.denyAuthorization(authorizationId);
   if(result.error||!result.data?.redirect_url)throw Error(result.error?.message||'Autorização não concluída.');
   window.location.assign(result.data.redirect_url);
  }catch(e){setNotice(String(e?.message||e).slice(0,230));setBusy(false)}
 }
 return <main style={{maxWidth:580,margin:'8vh auto',padding:26,background:'var(--panel,#17171b)',borderRadius:14}}>
  <h1>Autorizar Killa AI MCP</h1>
  <p>Um assistente externo solicita acesso de leitura ao INFINITUM. O MCP consulta apenas a empresa e as conversas permitidas para sua conta. Nenhuma ferramenta MCP envia mensagens de WhatsApp.</p>
  {loading&&<p>Verificando sessão...</p>}
  {!loading&&!session?.user&&<p>Entre no INFINITUM neste navegador e volte a este endereço para autorizar a conexão. <a href="/">Entrar</a></p>}
  {!authorizationId&&<p>Solicitação OAuth não identificada.</p>}
  {session?.user&&!db?.auth?.oauth&&<p>O cliente de autenticação precisa ser atualizado para suportar OAuth 2.1.</p>}
  {details&&<section style={{padding:'12px 0'}}>
   {clientId?
    <><p>Aplicativo: <strong>{details.client?.name||'Cliente MCP'}</strong></p>
     <p>ID OAuth: <code>{clientId}</code></p>
     {!approvedClients.includes(clientId)&&<label style={{display:'flex',gap:10,alignItems:'flex-start',padding:12,
        border:'1px solid #8a6077',borderRadius:9,color:'#f7dfeb'}}>
       <input type="checkbox" checked={confirmNewClient} onChange={e=>setConfirmNewClient(e.target.checked)}/>
       Autorizo este cliente OAuth a consultar meus dados de CRM por 30 dias, sem permissão para enviar mensagens, editar registros ou executar ações externas.
      </label>}
     {!approvedClients.includes(clientId)&&confirmNewClient&&<label style={{display:'flex',gap:9,alignItems:'flex-start',marginTop:12}}>
      <input type="checkbox" checked={allowReviewedEdits} onChange={e=>setAllowReviewedEdits(e.target.checked)}/>
      Permitir também que este agente <strong>proponha alterações</strong> em notas, retornos, prioridades e responsáveis. Cada mudança exigirá minha aprovação e MFA no OpenBot; nada será aplicado automaticamente.
     </label>}
     <p>Permissões solicitadas: {String(details.scope||'não informadas')}</p>
     <p>Destino de retorno: {details.redirect_uri}</p>
    </>
    :<p>Aplicativo MCP com autorização anterior. Confirme novamente o segundo fator para continuar.</p>}
   {!mfaOk&&<div style={{padding:14,border:'1px solid #8a6a25',borderRadius:10,margin:'14px 0'}}>
    <p role="alert">O segundo fator precisa ser confirmado nesta sessão antes de liberar o token OAuth.</p>
    {mfaFactorId?
     <><label htmlFor="killa-mfa-code">Código do aplicativo autenticador</label>
      <input id="killa-mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
       value={mfaCode} onChange={e=>setMfaCode(e.target.value.replace(/\D/g,'').slice(0,6))}
       style={{display:'block',margin:'8px 0',padding:10,width:'100%'}}/>
      <button type="button" disabled={mfaBusy||!/^\d{6}$/.test(mfaCode)} onClick={verifyMfa}>
       {mfaBusy?'Confirmando…':'Confirmar segundo fator'}
      </button></>
     :<p>Não há autenticador verificado nesta conta. <a href="/mcp/setup">Configure o segundo fator no INFINITUM</a>.</p>}
   </div>}
   {clientId&&<><p>Confirme somente se reconhece este aplicativo. O acesso permanece limitado às regras da sua empresa.</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
     <button type="button" disabled={busy||!mfaOk||(!clientApproved&&!confirmNewClient)} onClick={()=>decide(true)}>Autorizar leitura</button>
     <button type="button" disabled={busy} onClick={()=>decide(false)}>Negar acesso</button>
    </div></>}
  </section>}
  {notice&&<p role="alert">{notice}</p>}
 </main>;
}
