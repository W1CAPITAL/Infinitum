'use client';
import {useEffect,useState} from 'react';
import {useWorkspaceSession} from '../../../components/workspace-session-provider.jsx';
import {withAuthDeadline} from '../../../lib/auth-deadline.mjs';
import ui from '../../../components/killa-workbench.module.css';

const SHARED_LEXIS_DB=process.env.NEXT_PUBLIC_LEXIS_SHARED_DB==='1';
const MCP_URL=SHARED_LEXIS_DB
 ?'https://agentinfinitum.vercel.app/mcp'
 :'https://ulkuhiibeoibbzhqrfya.supabase.co/functions/v1/killa-mcp';
const DEFAULT_POLICY={mcp_enabled:false,permission_level:'basico',mcp_group_history_enabled:false,
 mcp_allowed_client_ids:[],allowed_client_ids:[],require_mfa:true,mcp_pairing_enabled:false,mcp_send_enabled:false};

async function companyPolicyRequest(db,method,payload){
 const auth=await db.auth.getSession();
 const token=auth.data?.session?.access_token;
 if(auth.error||!token)throw Error('Faça login novamente no INFINITUM.');
 const response=await fetch('/api/office/agent/company',{method,cache:'no-store',headers:{
  Authorization:'Bearer '+token,
  ...(payload?{'Content-Type':'application/json'}:{})
 },...(payload?{body:JSON.stringify(payload)}:{})});
 const result=await response.json().catch(()=>({ok:false,error:'Resposta inválida da API da empresa.'}));
 if(!response.ok||result?.ok!==true)throw Error(result?.error||'Não foi possível acessar as regras da empresa.');
 return result;
}

export default function KillaMcpSetup(){
 const {db,session,loading,authFault}=useWorkspaceSession();
 const [role,setRole]=useState(''),[policy,setPolicy]=useState(DEFAULT_POLICY);
 const [clientIdsText,setClientIdsText]=useState('');
 const [checking,setChecking]=useState(false),[saving,setSaving]=useState(false);
 const [mfaStatus,setMfaStatus]=useState('desconhecido'),[mfaFactor,setMfaFactor]=useState('');
 const [mfaQr,setMfaQr]=useState(''),[mfaCode,setMfaCode]=useState('');
 const [mfaBusy,setMfaBusy]=useState(false),[mfaNotice,setMfaNotice]=useState('');
 const [notice,setNotice]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  if(!db||!session?.user?.id)return;
  let active=true;setChecking(true);setError('');setNotice('');
  (async()=>{
   if(SHARED_LEXIS_DB){
    const company=await withAuthDeadline(companyPolicyRequest(db,'GET'),12000);
    if(!active)return;
    setRole(company.canConfigure===true?'admin':'operator');
    const saved={...DEFAULT_POLICY,...(company.policy||{})};
    setPolicy(saved);
    setClientIdsText((saved.mcp_allowed_client_ids||[]).join('\n'));
   }else{
    const [membership,settings]=await withAuthDeadline(Promise.all([
     db.from('crm_memberships').select('role,enabled').eq('user_id',session.user.id).maybeSingle(),
     db.from('killa_mcp_settings').select('mcp_enabled,permission_level,mcp_group_history_enabled,allowed_client_ids,require_mfa,mcp_pairing_enabled,mcp_send_enabled')
      .eq('owner_id',session.user.id).maybeSingle()
    ]),12000);
    if(membership.error)throw Error('Não foi possível verificar o perfil: '+membership.error.message);
    if(settings.error)throw Error('Não foi possível ler as regras MCP: '+settings.error.message);
    if(!active)return;
    setRole(membership.data?.enabled===true?membership.data.role||'':'');
    const saved={...DEFAULT_POLICY,...(settings.data||{})};
    setPolicy(saved);setClientIdsText((saved.allowed_client_ids||[]).join('\n'));
   }
   try{
    const [mfa,factors]=await Promise.all([
     withAuthDeadline(db.auth.mfa.getAuthenticatorAssuranceLevel(),9000),
     withAuthDeadline(db.auth.mfa.listFactors(),9000)
    ]);
    if(!active)return;
    if(mfa.error||factors.error){setMfaStatus('desconhecido');return}
    const verified=(factors.data?.totp||[]).find(x=>x.status==='verified');
    setMfaFactor(verified?.id||'');
    setMfaStatus(mfa.data?.currentLevel==='aal2'?'ativo':'pendente');
   }catch{if(active)setMfaStatus('desconhecido')}
  })().catch(e=>{if(active)setError(String(e.message||e))}).finally(()=>{if(active)setChecking(false)});
  return()=>{active=false};
 },[db,session?.user?.id]);
 const canEdit=role==='admin'&&!checking&&!error;
 async function enrollMfa(){
  if(!db||mfaBusy||mfaStatus==='ativo')return;
  setMfaBusy(true);setMfaNotice('');
  try{
   const result=await db.auth.mfa.enroll({factorType:'totp',friendlyName:'INFINITUM Killa MCP'});
   if(result.error)throw result.error;
   setMfaFactor(result.data.id);
   setMfaQr(String(result.data.totp?.qr_code||''));
   setMfaNotice('Escaneie o QR com seu aplicativo autenticador. Depois informe o código de seis dígitos.');
  }catch(e){setMfaNotice('Não foi possível iniciar o segundo fator: '+String(e.message||e).slice(0,180))}
  finally{setMfaBusy(false)}
 }
 async function verifyMfa(){
  if(!db||!mfaFactor||mfaBusy)return;
  if(!/^\d{6}$/.test(mfaCode)){setMfaNotice('Digite os seis dígitos do aplicativo autenticador.');return}
  setMfaBusy(true);setMfaNotice('');
  try{
   const result=await db.auth.mfa.challengeAndVerify({factorId:mfaFactor,code:mfaCode});
   if(result.error)throw result.error;
   const assurance=await db.auth.mfa.getAuthenticatorAssuranceLevel();
   if(assurance.error||assurance.data?.currentLevel!=='aal2')
    throw Error('O Supabase ainda não confirmou o nível AAL2. Tente novamente com um código novo.');
   setMfaStatus('ativo');setMfaQr('');setMfaCode('');
   setMfaNotice('Segundo fator confirmado. Esta sessão agora está em AAL2.');
  }catch(e){setMfaNotice('Não foi possível confirmar o código: '+String(e.message||e).slice(0,180))}
  finally{setMfaBusy(false)}
 }
 async function save(){
  if(!canEdit||!db||!session?.user?.id||saving)return;
  const ids=[...new Set(clientIdsText.split(/[\n,]+/).map(x=>x.trim()).filter(Boolean))];
  if(ids.length>20||ids.some(x=>!/^[A-Za-z0-9._:-]{5,200}$/.test(x))){
   setError('Informe no máximo 20 IDs OAuth válidos, um por linha, sem senhas ou tokens.');return;
  }
  setSaving(true);setNotice('');setError('');
  try{
   if(SHARED_LEXIS_DB){
    const result=await withAuthDeadline(companyPolicyRequest(db,'POST',{action:'settings',policy:{
     ...policy,mcp_enabled:policy.mcp_enabled===true,
     mcp_group_history_enabled:policy.mcp_enabled&&policy.mcp_group_history_enabled===true,
     mcp_allowed_client_ids:ids
    }}),12000);
    const saved={...DEFAULT_POLICY,...result.policy};
    setPolicy(saved);setClientIdsText((saved.mcp_allowed_client_ids||[]).join('\n'));
    setNotice(result.notice||'Regras MCP salvas na política da empresa.');
   }else{
    const payload={...policy,owner_id:session.user.id,allowed_client_ids:ids,
     require_mfa:true,mcp_enabled:policy.mcp_enabled===true,
     mcp_group_history_enabled:policy.mcp_enabled&&policy.mcp_group_history_enabled===true,
     mcp_pairing_enabled:policy.mcp_enabled&&policy.mcp_pairing_enabled===true,
     mcp_send_enabled:policy.mcp_enabled&&policy.mcp_send_enabled===true,updated_at:new Date().toISOString()};
    const result=await withAuthDeadline(db.from('killa_mcp_settings').upsert(payload,{onConflict:'owner_id'})
     .select('mcp_enabled,permission_level,mcp_group_history_enabled,allowed_client_ids,require_mfa,mcp_pairing_enabled,mcp_send_enabled')
     .single(),12000);
    if(result.error||!result.data)throw Error(result.error?.message||'O banco não confirmou a gravação.');
    setPolicy({...DEFAULT_POLICY,...result.data});
    setClientIdsText((result.data.allowed_client_ids||[]).join('\n'));
    setNotice('Regras salvas e confirmadas no Supabase. O aplicativo externo ainda precisa concluir OAuth e MFA.');
   }
  }catch(e){setError('Não foi possível salvar: '+String(e.message||e).slice(0,210))}
  finally{setSaving(false)}
 }
 return <main className={ui.mcpSetup}>
  <header className={ui.mcpHeading}><a href="/agentes">Voltar aos agentes</a><h1>Conectar assistentes externos</h1>
   <p>Configure o Killa AI por MCP. Isso permite acesso autorizado a leitura e rascunhos; não conecta o WhatsApp e não envia mensagens automaticamente.</p></header>
  {loading||checking?<p role="status">Verificando sessão e permissões…</p>:!session?.user?
   <div role="alert" className={ui.mcpCard}><strong>Entre no INFINITUM</strong><p>{authFault||'Você precisa estar autenticado para configurar o MCP.'}</p>
    <a href="/">Ir para o login</a></div>:
   <>
    <section className={ui.mcpCard}>
     <h2>1. Permissões da sua conta</h2>
     <p><strong>Perfil:</strong> {role==='admin'?'Administrador':role==='operator'?'Sem permissão de administrador':role||'sem acesso de administrador'} · <strong>MFA:</strong> {mfaStatus==='ativo'?'ativo':mfaStatus==='pendente'?'ainda não validado':'não verificado'}</p>
     {!canEdit&&<p role="alert">{SHARED_LEXIS_DB
      ?'Esta configuração exige o perfil Administrador na carteira LexisPredict vinculada à sua conta. A autorização é verificada pela empresa, não por crm_memberships.'
      :'Esta configuração exige perfil administrador ativo em crm_memberships. Um usuário comum não pode ativar o MCP. Peça ao administrador do CRM para habilitar sua conta.'}</p>}
     {mfaStatus!=='ativo'&&<div className={ui.mcpCard}>
      <h3>Ativar segundo fator nesta conta</h3>
      <p>Use um aplicativo autenticador. O QR é individual e só é exibido nesta sessão; não o compartilhe.</p>
      {!mfaFactor&&<button type="button" disabled={mfaBusy} onClick={enrollMfa}>{mfaBusy?'Gerando QR…':'Gerar QR do autenticador'}</button>}
      {mfaQr&&<div><img src={mfaQr} alt="QR individual para configurar o segundo fator" width="220" height="220"/>
       <p>Escaneie o QR no aplicativo autenticador e digite o código atual abaixo.</p></div>}
      {mfaFactor&&<label className={ui.field}>Código de seis dígitos
       <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
        value={mfaCode} onChange={e=>setMfaCode(e.target.value.replace(/\D/g,'').slice(0,6))}/>
      </label>}
      {mfaFactor&&<button type="button" disabled={mfaBusy||!/^\d{6}$/.test(mfaCode)} onClick={verifyMfa}>
       {mfaBusy?'Confirmando…':'Confirmar segundo fator'}
      </button>}
      {mfaNotice&&<p role="status">{mfaNotice}</p>}
     </div>}
    </section>
    <section className={ui.mcpCard}>
     <h2>2. Ativação do MCP</h2>
     <label className={ui.mcpCheck}><input type="checkbox" disabled={!canEdit} checked={policy.mcp_enabled}
      onChange={e=>setPolicy(p=>({...p,mcp_enabled:e.target.checked}))}/>Permitir conexão de aplicativos externos aprovados</label>
     <label className={ui.field}>Permissões do aplicativo
      <select disabled={!canEdit||!policy.mcp_enabled} value={policy.permission_level}
       onChange={e=>setPolicy(p=>({...p,permission_level:e.target.value}))}>
       <option value="basico">Básico · verificar estado</option>
       <option value="medio">Médio · ler histórico autorizado</option>
       <option value="alto">Alto · consultar fontes autorizadas</option>
       <option value="muito_alto">Muito alto · revisão ampliada, sem envio automático</option>
       <option value="maximo">Máximo · revisão ampliada, sem envio automático</option>
      </select></label>
    </section>
    <section className={ui.mcpCard}>
     <h2>3. Aplicativos autorizados</h2>
     <p>{SHARED_LEXIS_DB
      ?'Esta instalação usa a carteira compartilhada do LexisPredict. Ative o OAuth Server no projeto Supabase usado pelo login do INFINITUM. Depois, copie o ID público que o aplicativo MCP registrar.'
      :'No painel de autenticação do Supabase, ative o OAuth Server e o consentimento do usuário. Quando o aplicativo externo registrar seu cliente OAuth, copie apenas o ID público para o campo abaixo.'}</p>
     <label className={ui.field}>IDs OAuth (um por linha)
      <textarea rows={3} disabled={!canEdit} spellCheck={false} value={clientIdsText} onChange={e=>setClientIdsText(e.target.value)}
       placeholder="ID público do aplicativo externo"/></label>
     {SHARED_LEXIS_DB&&<p>Com o campo “Sign-in app” vazio, o OpenMausBot usa registro dinâmico e pode gerar um novo ID OAuth a cada novo login. Para manter um ID fixo, informe ali um Client ID público já registrado no Supabase e com o callback local correspondente; deixe o Client Secret vazio para clientes públicos. O ID fixo também precisa estar nesta lista. Se preferir registro dinâmico, deixe o campo vazio e autorize o ID de cada nova solicitação.</p>}
     <p>Para usar em um cliente MCP que aceite OAuth, informe este endereço:</p>
     <div className={ui.mcpEndpoint}><code>{MCP_URL}</code>
      <button type="button" onClick={()=>{if(!navigator.clipboard?.writeText){setError('Copie o endereço manualmente.');return}navigator.clipboard.writeText(MCP_URL)
       .then(()=>setNotice('Endereço MCP copiado.')).catch(()=>setError('Copie o endereço manualmente.'))}}>Copiar URL</button></div>
     <p>{SHARED_LEXIS_DB
      ?'Este é o endpoint MCP do próprio INFINITUM. Ele usa a sessão e as regras da empresa no banco compartilhado, sem trocar o Supabase principal do CRM.'
      :'O link acima é do serviço MCP instalado no Supabase, independente da hospedagem do site na Vercel.'}</p>
    </section>
    <details className={ui.mcpCard}><summary>Permissões adicionais (avançado)</summary>
     <label className={ui.mcpCheck}><input type="checkbox" disabled={!canEdit||!policy.mcp_enabled}
      checked={policy.mcp_group_history_enabled} onChange={e=>setPolicy(p=>({...p,mcp_group_history_enabled:e.target.checked}))}/>
      Leitura de grupos previamente arquivados</label>
     {!SHARED_LEXIS_DB&&<>
      <label className={ui.mcpCheck}><input type="checkbox" disabled={!canEdit||!policy.mcp_enabled}
       checked={policy.mcp_pairing_enabled} onChange={e=>setPolicy(p=>({...p,mcp_pairing_enabled:e.target.checked}))}/>
       Autorizar recursos sensíveis de pareamento a aplicativos aprovados</label>
      <label className={ui.mcpCheck}><input type="checkbox" disabled={!canEdit||!policy.mcp_enabled}
       checked={policy.mcp_send_enabled} onChange={e=>setPolicy(p=>({...p,mcp_send_enabled:e.target.checked}))}/>
       Permitir solicitações de envio com aprovação humana individual (nunca envio direto)</label>
     </>}
     {SHARED_LEXIS_DB&&<p>Na carteira compartilhada, o MCP permite leitura e preparação de rascunhos. Pareamento e envio pelo assistente externo permanecem desativados; qualquer mensagem ao cliente exige conferência e ação no INFINITUM.</p>}
     <a href="/mcp/pair">Vincular WhatsApp individual</a>
    </details>
    <div className={ui.mcpFooter}><button type="button" disabled={!canEdit||saving} onClick={save}>
     {saving?'Salvando…':'Salvar regras MCP'}</button>
     <p>Ao salvar, nenhuma mensagem é enviada e nenhum aplicativo é automaticamente conectado.</p></div>
   </>}
  {error&&<p role="alert" className={ui.mcpError}>{error}</p>}
  {notice&&<p role="status" className={ui.mcpSuccess}>{notice}</p>}
 </main>;
}
