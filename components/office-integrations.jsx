'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Bot,CalendarDays,MessageSquare,ExternalLink,Scale,FileSearch,Cloud,ShieldCheck} from 'lucide-react';
import SecuredWorkspace from './secured-workspace';
import {serviceState} from '../lib/infinitum-agent-policy.mjs';
import {createIcsEvent} from '../lib/blackhole-free-integrations.mjs';
const OPTIONS=[
 {title:'Superagente',icon:Bot,desc:'Motor de evidências, Qwen 0.5B local sob demanda e IA gratuita opcional.',route:'/superagente',type:'ai'},
 {title:'WA.Auto · WhatsApp interno',icon:MessageSquare,desc:'Conversas, QR Code e mensagens no próprio CRM com o worker Baileys.',route:'/whatsapp',type:'wa'},
 {title:'Leads',icon:Cloud,desc:'Cadastro, qualificação e importação de leads para seu escritório.',route:'/leads',type:'local'},
 {title:'Scanner judicial',icon:FileSearch,desc:'DataJud e DJEN públicos, sujeitas aos bloqueios reais dos tribunais.',route:'/scanner',type:'local'},
 {title:'Peças e petições',icon:Scale,desc:'Minutas estruturadas e IA online autorizada para aprimorar rascunhos.',route:'/pecas',type:'ai'},
 {title:'Audiências e agenda',icon:CalendarDays,desc:'Controle interno e exportação gratuita por arquivo de calendário.',route:'/audiencias',type:'local'}
];
const getItems=p=>Array.isArray(p?.items)?p.items:[];
function Body({db}){
 const [ai,setAi]=useState({configured:false}),[wa,setWa]=useState({configured:false});
 const [checks,setChecks]=useState({ai:{status:'pending'},wa:{status:'pending'},courts:{status:'pending'}}),[checkedAt,setCheckedAt]=useState(null),[loading,setLoading]=useState(false),[query,setQuery]=useState('');
 const inFlight=useRef(false);
 const [courts,setCourts]=useState([]),[more,setMore]=useState(false),[notice,setNotice]=useState('');
 const [event,setEvent]=useState({title:'',date:'',description:''});
 const load=useCallback(async()=>{
  if(inFlight.current)return;inFlight.current=true;setLoading(true);setChecks({ai:{status:'pending'},wa:{status:'pending'},courts:{status:'pending'}});
  try{
   const {data:{session}}=await db.auth.getSession();if(!session?.access_token)throw Error('Sessão indisponível.');
   const init={headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'};
   const get=async path=>{const response=await fetch(path,{...init,signal:AbortSignal.timeout(15000)});const body=await response.json();if(!response.ok||!body?.ok)throw Error('Consulta indisponível');return body};
   const requests=await Promise.allSettled(['/api/office/ai/status','/api/office/whatsapp/status','/api/office/courts'].map(get));
   setChecks({ai:requests[0],wa:requests[1],courts:requests[2]});
   setAi(requests[0].status==='fulfilled'?requests[0].value:{configured:false});setWa(requests[1].status==='fulfilled'?requests[1].value:{configured:false});setCourts(requests[2].status==='fulfilled'?getItems(requests[2].value):[]);setCheckedAt(new Date());
  }catch{setChecks({ai:{status:'rejected'},wa:{status:'rejected'},courts:{status:'rejected'}});setAi({});setWa({});setCourts([])}finally{setLoading(false);inFlight.current=false}
 },[db]);
 useEffect(()=>{load().catch(()=>{})},[load]);
 const status=k=>k==='ai'||k==='wa'?serviceState(checks[k],k):{label:'Recurso interno · abrir para usar',tone:'neutral'};
 const visibleCourts=courts.filter(item=>String(item.label||'').toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')));
 function createEvent(e){
  e.preventDefault();
  try{
   const content=createIcsEvent({...event,uid:'blackhole-'+Date.now()});
   const obj=new Blob([content],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(obj);
   const a=document.createElement('a');a.href=url;a.download='blackhole-agenda.ics';a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1200);
   setNotice('Compromisso exportado. A inclusão no calendário é manual e não confirma pauta judicial.');
  }catch(err){setNotice(err.message)}
 }
 return <main className="inf-studio blackhole-native-integrations">
  <header className="inf-heading"><div><small>INFINITUM / CENTRAL DE CONEXÕES</small><h1>Integrações e conexões</h1>
   <p>Ferramentas operacionais do escritório. Só indicamos uma integração como conectada quando há evidência real de conexão.</p></div>
   <button type="button" className="inf-btn" onClick={load} disabled={loading}>{loading?'Verificando…':'Atualizar status'}</button>
  </header>
  <div className="inf-integration-health"><div><strong>Inteligência artificial</strong><span data-tone={status('ai').tone}>{status('ai').label}</span></div><div><strong>WhatsApp</strong><span data-tone={status('wa').tone}>{status('wa').label}</span></div><div><strong>Diretório judicial</strong><span data-tone={serviceState(checks.courts,'courts').tone}>{serviceState(checks.courts,'courts').label}</span></div><small>{checkedAt?'Última verificação: '+checkedAt.toLocaleString('pt-BR'):'Aguardando consulta'}</small></div>
  <div className="blackhole-native-integrations-grid">
   {OPTIONS.map(item=>{const Icon=item.icon;return <Link key={item.title} href={item.route} className="blackhole-native-integration">
    <span className="blackhole-native-icon"><Icon size={20}/></span><strong>{item.title}</strong><p>{item.desc}</p>
    <small data-tone={status(item.type).tone}>{status(item.type).label}</small>
   </Link>})}
  </div>
  <div className="inf-integrations-desk"><section className="inf-panel"><h2><ShieldCheck size={16}/> WA.Auto · WhatsApp sem API oficial</h2>
   <p>O CRM usa o WA.Auto/Baileys em um worker persistente. Abra as conversas aqui mesmo, conecte seu aparelho e envie após revisar a mensagem. O serviço precisa de credenciais configuradas no Vercel.</p>
   <div className="office-action-row"><Link href="/whatsapp" className="inf-btn primary">Abrir atendimento e conversa</Link>
    <a href="https://web.whatsapp.com/" className="inf-btn" rel="noopener noreferrer" target="_blank">Abrir WhatsApp Web <ExternalLink size={13}/></a></div>
   <p>WA.Auto utiliza Baileys; Wechaty e Evolution são alternativas que exigem servidor persistente. A conexão só é indicada quando o serviço confirma o estado conectado. Nenhum deles está vinculado automaticamente ao BLACKHOLE. Conexão por QR não será indicada sem QR verdadeiro.</p>
  </section>
  <section className="inf-panel"><h2><Bot size={16}/> Motores de inteligência artificial</h2>
   <div className="office-panel-grid">
    <article className="office-record"><strong>Respostas rápidas e evidências</strong><p>Regras verificáveis e consulta aos dados autorizados, sem download e sem token.</p><small>Disponível</small></article>
    <article className="office-record"><strong>Qwen 0.5B no navegador</strong><p>CPU/WebAssembly por padrão, pesos baixados sob demanda. Disponibilidade depende da capacidade do aparelho.</p><small>Opcional · executar no Superagente</small></article>
    <article className="office-record"><strong>OpenRouter gratuito</strong><p>{ai.configured?'Chave privada cadastrada no servidor. É necessário autorizar cada envio.':'Sem chave válida detectada nesta sessão.'}</p><small>{status('ai').label}</small></article>
   </div>
  </section>
  <section className="inf-panel"><h2>Agenda local gratuita (.ics)</h2>
   <p>Exporte para Google Calendar, Outlook ou outro calendário sem API paga. Confira a data em publicação oficial antes de usar em prazo judicial.</p>
   <form className="office-form-col" onSubmit={createEvent}><div className="inf-fields">
     <label>Título<input required minLength={2} value={event.title} onChange={e=>setEvent({...event,title:e.target.value})}/></label>
     <label>Data<input type="date" required value={event.date} onChange={e=>setEvent({...event,date:e.target.value})}/></label>
     <label>Observações<input maxLength={300} value={event.description} onChange={e=>setEvent({...event,description:e.target.value})}/></label>
    </div><div className="inf-row-end"><button type="submit" className="inf-btn primary">Exportar compromisso</button></div></form>
  </section>
  </div>{courts.length>0&&<section className="inf-panel"><h2>Fontes dos tribunais · links oficiais públicos</h2>
   <label className="inf-integration-search">Buscar tribunal<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome do tribunal"/></label><p>{visibleCourts.length} de {courts.length} fontes cadastradas para abrir no portal do tribunal. Links não substituem consulta autenticada ou confirmação de audiências.</p>
   <div className="blackhole-native-integrations-grid">
    {visibleCourts.slice(0,more?visibleCourts.length:9).map(item=><a key={item.id} className="blackhole-native-integration" href={item.url} rel="noopener noreferrer" target="_blank"><strong>{item.label}</strong><small>Consultar site oficial <ExternalLink size={12}/></small></a>)}
   </div>
   {visibleCourts.length>9&&<button className="inf-btn" type="button" onClick={()=>setMore(x=>!x)}>{more?'Mostrar menos':'Mostrar todas as fontes'}</button>}
  </section>}
  {notice&&<div className="inf-note" role="status">{notice}</div>}
 </main>;
}
export default function OfficeIntegrations(){return <SecuredWorkspace active="Integrações">{({db})=><Body db={db}/>}</SecuredWorkspace>}
