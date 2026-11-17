'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useWorkspaceSession} from '../../../components/workspace-session-provider.jsx';
import './admin.css';
const URL='https://ulkuhiibeoibbzhqrfya.supabase.co/functions/v1/killa-store-admin';
const versionPattern=/^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
export default function StoreSuperadmin(){
 const {db,session,loading}=useWorkspaceSession();
 const [access,setAccess]=useState(null),[data,setData]=useState(null),[step,setStep]=useState(null);
 const [tab,setTab]=useState('build'),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [factor,setFactor]=useState(''),[qr,setQr]=useState(''),[totp,setTotp]=useState('');
 const [version,setVersion]=useState(''),[reason,setReason]=useState(''),[chosen,setChosen]=useState(null),[typed,setTyped]=useState('');
 const request=useCallback(async(path,method='GET',payload)=>{
  if(!db)throw Error('Autenticação indisponível.');
  const {data:auth,error}=await db.auth.getSession();
  if(error||!auth?.session?.access_token)throw Error('Faça login novamente.');
  const response=await fetch(URL+'/'+path,{method,cache:'no-store',headers:{
   Authorization:'Bearer '+auth.session.access_token,'Content-Type':'application/json'
  },...(payload?{body:JSON.stringify(payload)}:{})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok===false)throw Error(String(result.error||'Acesso negado').slice(0,100));
  return result;
 },[db]);
 const refresh=useCallback(async()=>{const r=await request('status');setData(r)},[request]);
 useEffect(()=>{
  if(loading||!db||!session?.user?.id){setAccess(null);setData(null);return}
  let live=true;
  (async()=>{
   try{
    const r=await request('access');
    if(!live)return;
    setAccess(r);
    // Even an already-AAL2 superadmin needs the verified TOTP factor id
    // to perform a FRESH challenge at the time of publication.
    const res=await db.auth.mfa.listFactors();
    const existing=(res.data?.totp||[]).find(x=>x.status==='verified');
    if(live&&existing)setFactor(existing.id);
    if(!r.needsMfa&&live)await refresh();
   }catch{if(live)setAccess({ok:false})}
  })();
  return()=>{live=false};
 },[loading,db,session?.user?.id,request,refresh]);
 async function task(fn){setBusy(true);setNotice('');try{await fn()}catch(e){setNotice('Operação bloqueada: '+String(e?.message||'Erro').slice(0,130))}finally{setBusy(false)}}
 async function enroll(){
  await task(async()=>{
   const result=await db.auth.mfa.enroll({factorType:'totp',friendlyName:'W1 Capital Loja'});
   if(result.error)throw result.error;
   setFactor(result.data.id);
   setQr(String(result.data.totp?.qr_code||''));
   setNotice('Escaneie o QR apenas com o seu autenticador. Nunca envie o segredo a outra pessoa.');
  });
 }
 async function verifyFactor(){
  if(!factor||!/^\d{6}$/.test(totp))return setNotice('Digite os seis dígitos TOTP.');
  await task(async()=>{
   const r=await db.auth.mfa.challengeAndVerify({factorId:factor,code:totp});
   if(r.error)throw r.error;
   setTotp('');setQr('');
   const x=await request('access');setAccess(x);await refresh();
  });
 }
 async function createRequest(){
  if(!versionPattern.test(version)||reason.trim().length<3)return setNotice('Informe uma versão x.y.z e justificativa.');
  await task(async()=>{
   await request('request','POST',{version,reason:reason.trim()});setVersion('');setReason('');
   await refresh();setNotice('Solicitação registrada; nenhuma publicação foi feita.');
  });
 }
 async function publish(){
  if(!chosen||typed!=='PUBLICAR '+chosen.version)return setNotice('Confirmação textual não corresponde à versão.');
  if(!/^\d{6}$/.test(totp))return setNotice('Digite um código novo do autenticador.');
  await task(async()=>{
   const mfa=await db.auth.mfa.challengeAndVerify({factorId:factor,code:totp});
   if(mfa.error)throw mfa.error;
   setTotp('');
   const r=await request('approve','POST',{requestId:chosen.id,typedVersion:chosen.version,confirmation:typed,confirm:true});
   setChosen(null);setTyped('');await refresh();setNotice(r.message);
  });
 }
 async function viewRun(id){
  await task(async()=>{setStep(await request('build-logs?runId='+encodeURIComponent(id)));setTab('logs')});
 }
 async function toggleMcp(enabled){
  await task(async()=>{await request('mcp-toggle','POST',{enabled});await refresh()});
 }
 if(loading)return <main className="store"><h1>Loja W1 Capital</h1><p>Validando sessão...</p></main>;
 if(!session?.user)return <main className="store"><h1>Loja W1 Capital</h1><p>Faça login.</p><Link href="/">Entrar</Link></main>;
 if(access?.ok===false)return <main className="store"><h1>Acesso negado</h1><p>Somente superadmin exclusivo da loja.</p><Link href="/agentes">Voltar ao INFINITUM</Link></main>;
 if(!access)return <main className="store"><h1>Loja W1 Capital</h1><p>Verificando superadmin...</p></main>;
 if(access.needsMfa)return <main className="store"><h1>Segurança extra da loja</h1><p>É obrigatório ativar o segundo fator TOTP para consultar logs e Env.</p>
  {!factor&&<button disabled={busy} onClick={enroll}>Ativar Google Authenticator / TOTP</button>}
  {qr&&<div><p>QR individual, não compartilhe.</p><img alt="QR do segundo fator do próprio superadmin" src={qr} width="230" height="230"/></div>}
  {factor&&<div><label>Código do autenticador <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,'').slice(0,6))}/></label><button disabled={busy} onClick={verifyFactor}>Confirmar segundo fator</button></div>}
  {notice&&<p role="status">{notice}</p>}
 </main>;
 if(!data)return <main className="store"><h1>Loja W1 Capital</h1><p>Carregando diagnósticos protegidos...</p></main>;
 return <main className="store">
  <header><div><small>W1 CAPITAL · SUPERADMIN MFA</small><h1>INFINITUM · Central de Publicações</h1><p>Somente resultados autorizados. Nenhuma chave privada será exibida.</p></div><button onClick={()=>task(refresh)} disabled={busy}>Atualizar</button></header>
  <nav aria-label="Administração exclusiva da loja">
   {['build','typecheck','logs','env','releases','audit'].map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{({build:'Build Logs',typecheck:'Typecheck',logs:'Logs',env:'Env',releases:'Publicações',audit:'Auditoria'})[t]}</button>)}
  </nav>
  {notice&&<p className="notice" role="status">{notice}</p>}
  {(tab==='build'||tab==='typecheck')&&<section className="grid">
   {data.workflows?.map(w=><article key={w.workflow}><h2>{w.workflow}</h2>{w.error&&<p>{w.error}</p>}
    {w.runs?.map(r=><div className="run" key={r.id}><div><b>{r.name}</b><p>{r.sha} · {r.status} · {r.conclusion||'executando'}</p></div>
    <button onClick={()=>viewRun(r.id)}>Ver etapas</button>{r.url&&<a href={r.url} target="_blank" rel="noopener noreferrer">GitHub</a>}</div>)}
   </article>)}
  </section>}
  {tab==='logs'&&<article><h2>Logs de etapas (sem segredos)</h2><p>Para ver o texto bruto, autentique-se separadamente no GitHub.</p>
   {!step&&<p>Abra uma execução em Build Logs ou Typecheck.</p>}
   {step?.jobs?.map((job,i)=><details key={i} open><summary>{job.name} — {job.conclusion||job.status}</summary>
    {job.steps?.map((x,j)=><p key={j}>{x.number}. {x.name}: {x.conclusion||x.status}</p>)}
    {job.url&&<a href={job.url} target="_blank" rel="noopener noreferrer">Logs completos no GitHub</a>}</details>)}
  </article>}
  {tab==='env'&&<article><h2>Env · verificação de configuração</h2><p>Apenas presença ou ausência. Valores, tokens, senhas e chaves nunca são retornados.</p>
   {Object.entries({supabaseAuth:'Autenticação Supabase',privateDatabase:'Banco privado',githubReadCapability:'GitHub logs: leitura',githubDispatchCapability:'GitHub: disparar publicação'}).map(([key,label])=><p key={key}>{label}: <strong>{data.env?.[key]?'Configurado':'Não configurado'}</strong></p>)}
   <p>Chave Ed25519: somente no ambiente protegido GitHub. Nunca recuperada pela loja.</p>
   <h2>MCP da loja</h2>
   <label><input type="checkbox" checked={data.permissions?.storeMcpEnabled===true} disabled={busy} onChange={e=>toggleMcp(e.target.checked)}/> Ativar conexão MCP administrativa para meu superadmin</label>
   <p>Além dessa opção, o cliente OAuth deve estar autorizado e usar MFA. A IA não aprova releases.</p>
  </article>}
  {tab==='releases'&&<article><h2>Criar pedido de versão</h2><label>Versão <input value={version} placeholder="0.1.1" onChange={e=>setVersion(e.target.value)} maxLength={15}/></label>
   <label>Justificativa<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></label>
   <button disabled={busy} onClick={createRequest}>Solicitar publicação</button>
   <h2>Pedidos</h2>{data.requests?.map(r=><div className="run" key={r.id}><div><b>v{r.version} — {r.status}</b><p>{r.reason} · {r.viaMcp?'via MCP':'via Loja'}</p></div>
    {r.status==='pending'&&<button onClick={()=>{setChosen(r);setTyped('');setTotp('')}}>Revisar</button>}</div>)}
   {chosen&&<section className="confirm"><h2>Confirmar versão {chosen.version}</h2>
    <p>Digite PUBLICAR {chosen.version}, confirme um código novo TOTP e aprove depois o ambiente desktop-production no GitHub.</p>
    <label>Confirmação<input value={typed} onChange={e=>setTyped(e.target.value)}/></label>
    <label>Código novo TOTP<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,'').slice(0,6))}/></label>
    <button disabled={busy||typed!=='PUBLICAR '+chosen.version} onClick={publish}>Solicitar execução protegida</button><button onClick={()=>setChosen(null)}>Cancelar</button>
   </section>}
  </article>}
  {tab==='audit'&&<article><h2>Auditoria da loja</h2>{data.audit?.map(a=><p key={a.id}>{a.date} · {a.action} · {a.requestId||'–'}</p>)}</article>}
 </main>;
}
