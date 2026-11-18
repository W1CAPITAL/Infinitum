'use client';
import {useState} from 'react';

// Usa a sessão do CRM já autenticada. O Worker verifica novamente MFA, empresa e permissões.
export default function OpenCodeDevicePanel({db,initialPrompt=''}) {
 const [devices,setDevices]=useState([]);
 const [deviceId,setDeviceId]=useState('');
 const [prompt,setPrompt]=useState(initialPrompt);
 const [sessionId,setSessionId]=useState('');
 const [consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('Conecte e autorize seu computador na Central de Apps.');
 const [result,setResult]=useState('');
 const rpc=async value=>{
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw Error('Entre no INFINITUM novamente.');
  const response=await fetch('/api/opencode/relay',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},cache:'no-store',body:JSON.stringify(value)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(response.status===401?'Sessão expirada.':response.status===403?'Autorize o MCP e confirme MFA na Central de Apps.':String(data.error||'Conexão com computador indisponível.'));
  return data;
 };
 const wait=async id=>{
  for(let attempt=0;attempt<36;attempt++){
   await new Promise(resolve=>setTimeout(resolve,2500));
   const job=await rpc({action:'task',jobId:id});
   if(job.status==='succeeded')return job.result;
   if(['failed','unknown','cancelled'].includes(job.status))throw Error(job.status==='unknown'?'Resultado incerto: não envie esta tarefa novamente até verificar no OpenCode.':'Operação recusada ou falhou no computador.');
  }
  throw Error('A tarefa continua aguardando confirmação. Consulte o OpenCode antes de tentar outra vez.');
 };
 const refresh=async()=>{
  setBusy(true);
  try{
   const rows=await rpc({action:'devices'});
   const list=Array.isArray(rows)?rows.filter(x=>x.state==='approved'&&x.online&&x.scopes?.includes('execute')):[];
   setDevices(list);setDeviceId(old=>list.some(x=>x.id===old)?old:list[0]?.id||'');
   setNotice(list.length?list.length+' computador(es) disponível(is).':'Nenhum computador ativo com permissão de executar. Abra a Central e pareie seu OpenCode.');
  }catch(e){setNotice(e.message);}
  finally{setBusy(false);}
 };
 const job=async(operation,input)=>{
  const value=await rpc({action:'submit',deviceId,operation,input,key:crypto.randomUUID()});
  if(!value?.id)throw Error('Ponte não forneceu o código da tarefa.');
  return wait(value.id);
 };
 const send=async()=>{
  if(!consent){setNotice('Confirme que deseja enviar o texto ao OpenCode e seu provedor configurado.');return}
  if(!deviceId||!prompt.trim()){setNotice('Escolha o computador e escreva uma tarefa.');return}
  setBusy(true);setResult('');
  try{
   let id=sessionId;
   if(!id){
    setNotice('Criando sessão — confirme no seu computador se solicitado.');
    const session=await job('create',{title:'Tarefa W1 Capital · Revisão humana'});
    id=session?.id||session?.data?.id;
    if(!/^ses[a-zA-Z0-9_-]+$/.test(id||''))throw Error('O OpenCode não confirmou a sessão. Não envie novamente até verificar.');
    setSessionId(id);
   }
   setNotice('Enviando tarefa — aprove no OpenCode local.');
   const receipt=await job('prompt',{sessionId:id,text:prompt.trim()});
   setResult(JSON.stringify(receipt??{},null,2).slice(0,12000));
   setNotice('O OpenCode respondeu à operação. Verifique a execução e os arquivos antes de aplicar mudanças.');
  }catch(error){setNotice(error.message)}
  finally{setBusy(false)}
 };
 const messages=async()=>{
  if(!sessionId||!deviceId)return;
  setBusy(true);
  try{setNotice('Lendo respostas confirmadas...');const content=await job('messages',{sessionId});setResult(JSON.stringify(content??{},null,2).slice(0,16000));setNotice('Respostas recebidas do OpenCode local.');}
  catch(e){setNotice(e.message)}
  finally{setBusy(false)}
 };
 return <details className="w1-opencode-bridge" style={{border:'1px solid #8a4555',borderRadius:14,padding:16,margin:'14px 0',background:'rgba(84,17,36,.10)'}}>
  <summary style={{cursor:'pointer',fontWeight:700,fontSize:14}}>OpenCode do computador · MCP autorizado</summary>
  <p style={{fontSize:12,lineHeight:1.5,opacity:.86}}>Use a IA configurada no seu computador. Não altera processos nem envia WhatsApp automaticamente. Requer Central de Apps aberta, computador pareado, MFA e aprovação local.</p>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
   <button type="button" disabled={busy} onClick={refresh}>Procurar meu computador</button>
   <label style={{fontSize:12}}>Computador <select disabled={busy||!devices.length} value={deviceId} onChange={e=>{setDeviceId(e.target.value);setSessionId('')}}><option value="">Selecione</option>{devices.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label>
  </div>
  <label style={{display:'block',margin:'12px 0',fontSize:12}}>Tarefa para o OpenCode
   <textarea style={{display:'block',width:'100%',minHeight:72,marginTop:5,background:'transparent',color:'inherit',border:'1px solid #81535e',borderRadius:8,padding:9}} maxLength={32000} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="O que você quer que o OpenCode faça?"/>
  </label>
  <label style={{display:'block',fontSize:12,marginBottom:10}}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Autorizo enviar esta tarefa ao OpenCode e ao provedor de IA configurado nele.</label>
  <div style={{display:'flex',flexWrap:'wrap',gap:8}}><button type="button" disabled={busy||!deviceId||!consent} onClick={send}>Executar no meu PC</button><button type="button" disabled={busy||!sessionId} onClick={messages}>Ver respostas</button><button type="button" disabled={busy} onClick={()=>{setSessionId('');setResult('');setNotice('Nova sessão na próxima tarefa.')}}>Nova sessão</button></div>
  <p role="status" style={{fontSize:12,overflowWrap:'anywhere'}}>{busy?'Aguardando confirmação · ':''}{notice}</p>
  {result&&<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:330,overflow:'auto',fontSize:11}}>{result}</pre>}
 </details>;
}
