'use client';
import Link from 'next/link';
import SecuredWorkspace from '../../components/secured-workspace';
import LexisOperations from '../../components/lexis-operations';

export default function VencidosPage(){
 if(process.env.NEXT_PUBLIC_LEXIS_SHARED_DB!=='1'){
  return <main className="reference-dashboard">
   <header className="reference-header"><div><div className="reference-overline">INFINITUM · INTELIGÊNCIA JURÍDICA</div><h1>Vencidos</h1><p>Esta fila empresarial é ativada quando o Infinitum está conectado à base compartilhada do LexisPredict.</p></div></header>
   <p className="inf-note">Abra Prazos para consultar os compromissos disponíveis nesta instalação.</p>
   <Link className="inf-btn" href="/prazos">Abrir Prazos</Link>
  </main>;
 }
 return <SecuredWorkspace active="Vencidos">{({db,session})=><LexisOperations area="overdue" db={db} session={session}/>}</SecuredWorkspace>;
}
