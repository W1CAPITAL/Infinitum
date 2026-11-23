'use client';
import SecuredWorkspace from '../../components/secured-workspace';
import LexisProcessIntelligenceWorkspace from '../../components/lexis-process-intelligence-workspace';
export default function ProcessosParadosPage(){
 return <SecuredWorkspace active="Processos parados">{({db,session})=>
  <LexisProcessIntelligenceWorkspace db={db} session={session} mode="parados"/>
 }</SecuredWorkspace>;
}
