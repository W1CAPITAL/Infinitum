'use client';
import {useCallback,useEffect,useState} from 'react';
const columns=[
 {key:'only_private',label:'Responder somente em conversas privadas'},
 {key:'require_process_context',label:'Ignorar assuntos sem relação com processos'},
 {key:'learning_enabled',label:'Aprender apenas com correções aprovadas'}
];
const categories=[
 {value:'staff_active',label:'Outro atendente assumiu a conversa'},
 {value:'silence',label:'Não atender este contato'},
 {value:'administrative',label:'Contato do administrativo: só quando mencionar o Killa AI'},
 {value:'review',label:'Encaminhar sempre para revisão humana'}
];
const numbers=str=>String(str||'').replace(/\D/g,'');
const toList=(text,kind)=>String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,100)
 .map(x=>({kind,value:kind==='phone'?numbers(x):x})).filter(x=>x.value.length>=3);
export default function OpenBotCompanySettings({db,jid='',contactName='',isGroup=false}){
 const [opened,setOpened]=useState(false),[policy,setPolicy]=useState(null);
 const [canEdit,setCanEdit]=useState(false),[busy,setBusy]=useState('');
 const [notice,setNotice]=useState(''),[rules,setRules]=useState([]);
 const [excludedPhones,setExcludedPhones]=useState(''),[excludedNames,setExcludedNames]=useState('');
 const [groupIds,setGroupIds]=useState(''),[mentions,setMentions]=useState('@KillaAI');
 const [mode,setMode]=useState('staff_active'),[days,setDays]=useState(7);
 const [groupTask,setGroupTask]=useState('');
 const api=useCallback(async(method,data)=>{
  const session=await db.auth.getSession();
  const token=session.data?.session?.access_token;
  if(!token)throw Error('Faça login no INFINITUM.');
  const response=await fetch('/api/office/agent/company',{method,
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   ...(data?{body:JSON.stringify(data)}:{}),cache:'no-store'});
  const result=await response.json().catch(()=>({error:'Resposta inválida da API da empresa.'}));
  if(!response.ok||!result?.ok)throw Error(result?.error||'Não foi possível concluir.');
  return result;
 },[db]);
 const load=useCallback(async()=>{
  const result=await api('GET');
  setPolicy(result.policy);
  setCanEdit(result.canConfigure===true);
  setRules(result.contacts||[]);
  setExcludedPhones((result.policy.excluded_contacts||[]).filter(x=>x.kind==='phone').map(x=>x.value).join('\n'));
  setExcludedNames((result.policy.excluded_contacts||[]).filter(x=>x.kind==='name').map(x=>x.value).join('\n'));
  setGroupIds((result.policy.allowed_group_jids||[]).join('\n'));
  setMentions((result.policy.bot_mentions||[]).join(', '));
 },[api]);
 useEffect(()=>{
  if(!opened)return;
  let alive=true;
  load().catch(error=>{if(alive)setNotice(error.message)});
  return()=>{alive=false};
 },[opened,load]);
 const update=(key,value)=>setPolicy(old=>({...old,[key]:value}));
 async function task(name,fn){
  if(busy)return;setBusy(name);setNotice('');
  try{await fn()}catch(e){setNotice('Não foi possível concluir: '+String(e.message||e).slice(0,210))}
  finally{setBusy('')}
 }
 const save=()=>task('save',async()=>{
  if(!canEdit)throw Error('Somente o administrador da empresa pode alterar as regras gerais.');
  const excluded=[...toList(excludedPhones,'phone'),...toList(excludedNames,'name')].slice(0,200);
  const ids=groupIds.split(/\r?\n/).map(x=>x.trim()).filter(x=>/^[0-9-]{6,30}@g\.us$/.test(x)).slice(0,70);
  const names=mentions.split(',').map(x=>x.trim()).filter(Boolean).slice(0,10);
  const answer=await api('POST',{action:'settings',policy:{...policy,excluded_contacts:excluded,
   allowed_group_jids:ids,bot_mentions:names}});
  setPolicy(answer.policy);setNotice(answer.notice);await load();
 });
 const guard=()=>task('contact',async()=>{
  if(!jid)throw Error('Escolha uma conversa WhatsApp.');
  const result=await api('POST',{action:'contact',jid,mode,days,
   assigned_staff:String(contactName||'Atendente').slice(0,90)});
  setNotice(result.notice);await load();
 });
 const registerTask=()=>task('group',async()=>{
  if(!isGroup)throw Error('Abra um grupo autorizado.');
  const r=await api('POST',{action:'group_task',jid,text:groupTask.trim()});
  setNotice(r.notice);setGroupTask('');
 });
 return <section style={{border:'1px solid #8885',borderRadius:10,margin:'10px 0',padding:10}}>
  <button type="button" className="wa-button ghost" onClick={()=>setOpened(v=>!v)}
   aria-expanded={opened}>{opened?'Recolher configurações':'Killa AI · regras da empresa e atendentes'}</button>
  {opened&&<div style={{display:'grid',gap:10,marginTop:10}}>
   <p style={{fontSize:12,margin:0}}>As configurações são separadas por empresa. O modo de envio permanece em <strong>rascunho com confirmação humana</strong>, sem disparos em massa. {canEdit?'Você pode editar as regras.':'Somente o administrador da empresa pode editá-las.'}</p>
   {policy&&<>
    {columns.map(x=><label key={x.key} style={{display:'flex',gap:7,alignItems:'center'}}>
     <input type="checkbox" checked={policy[x.key]===true} onChange={e=>update(x.key,e.target.checked)} disabled={!canEdit}/>
     {x.label}
    </label>)}
    <label style={{display:'grid',gap:4}}>Grupos
     <select disabled={!canEdit} value={policy.groups||'ignore'} onChange={e=>update('groups',e.target.value)}>
      <option value="ignore">Nunca responder ou registrar tarefas de grupos</option>
      <option value="internal_only">Somente grupos internos permitidos, quando marcarem o Killa AI</option>
      <option value="draft_only">Grupos da lista permitida: apenas rascunhos e tarefas para revisão</option>
     </select></label>
    <label style={{display:'grid',gap:4}}>Administrativo
     <select disabled={!canEdit} value={policy.administrative||'mention_only'}
      onChange={e=>update('administrative',e.target.value)}>
      <option value="ignore">Nunca responder</option>
      <option value="mention_only">Responder somente quando mencionarem @KillaAI e houver processo autorizado</option>
      <option value="manual_review">Sempre encaminhar para revisão humana</option>
     </select></label>
    <label style={{display:'flex',gap:8,alignItems:'center'}}>
     <input type="checkbox" disabled={!canEdit} checked={policy.mcp_enabled===true}
      onChange={e=>update('mcp_enabled',e.target.checked)}/>
     Autorizar MCP externo autenticado (ChatGPT, Claude, Grok, OpenCode e FreeBuff)
    </label>
    <label style={{display:'flex',gap:8,alignItems:'center'}}>
     <input type="checkbox" disabled={!canEdit||!policy.mcp_enabled} checked={policy.mcp_group_history_enabled===true}
      onChange={e=>update('mcp_group_history_enabled',e.target.checked)}/>
     Permitir leitura de grupos para operadores autenticados pelo MCP (nunca responder no grupo)
    </label>
    <small>O MCP é exclusivamente de leitura e preparação de rascunhos. Use OAuth com aprovação individual; nunca compartilhe tokens.</small>
    <label style={{display:'grid',gap:4}}>Nível de permissão do Killa AI
     <select disabled={!canEdit} value={policy.permission_level||'basico'} onChange={e=>update('permission_level',e.target.value)}>
      <option value="basico">Básico</option><option value="medio">Médio</option><option value="alto">Alto</option>
      <option value="muito_alto">Muito alto</option><option value="maximo">Máximo</option>
     </select>
     <small>Nenhum nível permite envio automático, ignorar as regras da empresa ou divulgar dados internos.</small>
    </label>
    <label style={{display:'grid',gap:4}}>Silenciar quando outro atendente falou com o mesmo cliente nas últimas (horas)
     <input type="number" min="1" max="48" disabled={!canEdit} style={{maxWidth:120}}
      value={Number(policy.staff_handoff_hours||8)}
      onChange={e=>update('staff_handoff_hours',Number(e.target.value))}/>
    </label>
    <label style={{display:'grid',gap:4}}>Áudio sem transcrição disponível
     <select disabled={!canEdit} value={policy.audio_without_transcript||'status_if_authorized'}
      onChange={e=>update('audio_without_transcript',e.target.value)}>
      <option value="status_if_authorized">Consultar andamento autorizado, sem pedir para reenviar o áudio</option>
      <option value="manual_review">Deixar para atendente humano</option>
     </select></label>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
     {[['return_min_days','Retorno mínimo (dias)'],['return_max_days','Retorno máximo (dias)'],
       ['return_stalled_days','Processo parado (dias)'],['stalled_after_days','Considerar parado após (dias)']].map(([key,label])=>
       <label key={key} style={{display:'grid',gap:4,fontSize:12,flex:'1 1 120px'}}>
        {label}<input type="number" min="7" max="365" disabled={!canEdit}
         value={Number(policy[key]||15)} onChange={e=>update(key,Number(e.target.value))} style={{maxWidth:130}}/>
       </label>)}
    </div>
    {jid&&!isGroup&&canEdit&&<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
     <button type="button" className="wa-button ghost" onClick={()=>{
      const num=numbers(jid.split('@')[0]);
      setExcludedPhones(old=>[...new Set([...old.split(/\r?\n/).filter(Boolean),num])].join('\n'));
      setNotice('Número adicionado à lista de exclusões; clique em Salvar regras desta empresa.');
     }}>Excluir conversa atual por número</button>
     {contactName&&<button type="button" className="wa-button ghost" onClick={()=>{
      setExcludedNames(old=>[...new Set([...old.split(/\r?\n/).filter(Boolean),contactName])].join('\n'));
      setNotice('Nome adicionado à lista de exclusões; clique em Salvar regras desta empresa.');
     }}>Excluir conversa atual por nome</button>}
    </div>}
    {isGroup&&canEdit&&<div style={{display:'grid',gap:4}}>
     <small>Identificador do grupo selecionado: {jid}</small>
     <button type="button" className="wa-button ghost" onClick={()=>{
      setGroupIds(old=>[...new Set([...old.split(/\r?\n/).filter(Boolean),jid])].join('\n'));
      setNotice('Grupo adicionado à lista interna. Salve as regras; as mensagens continuarão dependendo de menção ao Killa AI.');
     }}>Permitir grupo atual para tarefas internas</button>
    </div>}
    <label style={{display:'grid',gap:4}}>Contatos excluídos — números, um por linha
     <textarea rows={3} disabled={!canEdit} maxLength={2500} value={excludedPhones}
      onChange={e=>setExcludedPhones(e.target.value)} placeholder="5511999999999"/></label>
    <label style={{display:'grid',gap:4}}>Excluir contato por nome — um por linha
     <textarea rows={2} disabled={!canEdit} maxLength={2500} value={excludedNames}
      onChange={e=>setExcludedNames(e.target.value)} placeholder="Nome que não deve receber atendimento"/></label>
    <label style={{display:'grid',gap:4}}>Grupos internos permitidos (identificador do grupo por linha)
     <textarea rows={2} disabled={!canEdit} value={groupIds} maxLength={4000}
      onChange={e=>setGroupIds(e.target.value)} placeholder="120123456789012345@g.us"/></label>
    <label style={{display:'grid',gap:4}}>Como marcar o agente no WhatsApp
     <input disabled={!canEdit} maxLength={180} value={mentions}
      onChange={e=>setMentions(e.target.value)} placeholder="@KillaAI"/></label>
    <button type="button" className="wa-button" disabled={!canEdit||!!busy} onClick={save}>
     {busy==='save'?'Salvando...':'Salvar regras desta empresa'}</button>
   </>}
   {jid&&<div style={{padding:9,border:'1px solid #8884',borderRadius:8,display:'grid',gap:8}}>
    <strong>Conversa atual · proteger a atuação de outros atendentes</strong>
    <small>{contactName||jid} · regras temporárias aplicadas apenas à empresa deste usuário.</small>
    <label>Como tratar esta conversa
     <select value={mode} onChange={e=>setMode(e.target.value)}>
      {categories.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
     </select></label>
    <label>Manter a restrição por
     <select value={days} onChange={e=>setDays(Number(e.target.value))}>
      {[1,3,7,14,30].map(x=><option value={x} key={x}>{x} dia(s)</option>)}
     </select></label>
    <button type="button" className="wa-button ghost" disabled={!!busy} onClick={guard}>
     Registrar que outro atendente está cuidando deste contato</button>
    {rules.some(x=>x.jid===jid)&&<small>Regra atual: {rules.find(x=>x.jid===jid)?.mode} até {new Date(rules.find(x=>x.jid===jid)?.suppress_until).toLocaleDateString('pt-BR')}.</small>}
   </div>}
   {isGroup&&<div style={{padding:9,border:'1px solid #8884',borderRadius:8,display:'grid',gap:6}}>
    <strong>Transformar solicitação de grupo em tarefa</strong>
    <small>Somente grupos autorizados com menção ao Killa AI. Sem resposta automática.</small>
    <textarea rows={3} maxLength={450} value={groupTask} onChange={e=>setGroupTask(e.target.value)}
     placeholder="@KillaAI anote a tarefa de pedir orientação ao advogado..."/>
    <button type="button" className="wa-button ghost" disabled={!!busy||groupTask.trim().length<12}
     onClick={registerTask}>Registrar tarefa de grupo para revisão</button>
   </div>}
   {notice&&<p role="status" style={{margin:0,fontSize:12}}>{notice}</p>}
  </div>}
 </section>;
}
