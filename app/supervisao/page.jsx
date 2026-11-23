'use client';
import SecuredWorkspace from '../../components/secured-workspace';
import LexisIntelligenceWorkspace from '../../components/lexis-intelligence-workspace';

export default function SupervisaoPage(){
 return <SecuredWorkspace active="Supervisão">{({db,session})=>
  process.env.NEXT_PUBLIC_LEXIS_SHARED_DB==='1'
   ?<LexisIntelligenceWorkspace db={db} session={session} mode="supervision"/>
   :<main className="lxd-shell"><h1>Supervisão</h1><p className="lxd-message">Ative a conexão autenticada com a base jurídica compartilhada para consultar indicadores reais da organização. Nenhum dado será estimado.</p></main>
 }</SecuredWorkspace>;
}
