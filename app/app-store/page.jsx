'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight,LayoutDashboard,MessageCircle,ShieldCheck,Store} from 'lucide-react';
import SecuredWorkspace from '../../components/secured-workspace';
import {ZAPFAST_SINGLE_SESSION_URL} from '../../lib/openbot-workspace-policy.mjs';
import styles from './store.module.css';

function StoreContent(){
 const [desktop,setDesktop]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>setDesktop(typeof window.killaDesktop?.openZapFast==='function'),[]);
 async function openZapFast(){
  setError('');
  try{await window.killaDesktop.openZapFast()}
  catch{setError('O aplicativo não conseguiu abrir o ZapFast. Verifique a internet e o serviço.')}
 }
 return <main className={styles.store}>
  <header className={styles.hero}>
   <div className={styles.eyebrow}><Store size={16}/> W1 CAPITAL · CENTRAL DE APLICATIVOS</div>
   <h1>Central de Aplicativos <span>W1 Capital</span></h1>
   <p>Abra os módulos disponíveis no INFINITUM. Os serviços preservam suas autenticações independentes; a loja não instala aplicativos desconhecidos.</p>
   <div className={styles.badges}><span>Windows · Desktop</span><span>CRM local</span><span>Sem compartilhar senhas</span></div>
   <p><a className={styles.action} href="https://github.com/W1CAPITAL/Central-de-Apps/releases" target="_blank" rel="noopener noreferrer">Instalar pela Central de Apps W1 <ArrowUpRight size={17}/></a></p>
  </header>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  <div className={styles.grid}>
   <article className={styles.card}>
    <div className={styles.icon}><LayoutDashboard size={29}/></div>
    <div className={styles.tag}>INCLUÍDO</div>
    <h2>INFINITUM CRM</h2>
    <p>Atividades, processos, equipe e ferramentas da Killa AI no mesmo ambiente autenticado.</p>
    <Link className={styles.action} href="/dashboard">Abrir CRM <ArrowUpRight size={17}/></Link>
   </article>
   <article className={styles.card}>
    <div className={styles.icon}><MessageCircle size={29}/></div>
    <div className={styles.tag}>WORKSPACE DE AGENTES · INCLUÍDO</div>
    <h2>OpenBot · Agentes de IA</h2>
    <p>Converse com bots separados, escolha modelos online realmente configurados ou Qwen local opcional, salve seu histórico no Supabase e revise cada resposta.</p>
    <Link className={styles.action} href="/openbot">Abrir OpenBot <ArrowUpRight size={17}/></Link>
   </article>
   <article className={styles.card}>
    <div className={styles.icon}><MessageCircle size={29}/></div>
    <div className={styles.tag}>SERVIÇO CONECTADO SEPARADAMENTE</div>
    <h2>ZapFast · WhatsApp</h2>
    <p>Use a sessão do ZapFast em uma janela própria do desktop. A autenticação é exclusiva do ZapFast: o WhatsApp não é sincronizado automaticamente com o CRM.</p>
    {desktop?<button className={styles.action} type="button" onClick={openZapFast}>Abrir no desktop <ArrowUpRight size={17}/></button>:
     <a className={styles.action} href={ZAPFAST_SINGLE_SESSION_URL} rel="noopener noreferrer" target="_blank">Abrir ZapFast <ArrowUpRight size={17}/></a>}
   </article>
  </div>
  <section className={styles.admin}>
   <div><ShieldCheck size={24}/><div><strong>Administração da Killa AI Store</strong><p>Build logs, typecheck, publicações e auditoria. Acesso exclusivo ao superadmin com segundo fator.</p></div></div>
   <Link href="/app-store/admin">Administração restrita <ArrowUpRight size={16}/></Link>
  </section>
  <p className={styles.note}>ZapFast e WA.Auto são serviços diferentes. Troca de número e exclusão do histórico são operações do ZapFast e não acontecem automaticamente ao abrir a loja.</p>
 </main>;
}

export default function KillaAiStore(){
 return <SecuredWorkspace active="Killa AI Store">{()=> <StoreContent/>}</SecuredWorkspace>;
}
