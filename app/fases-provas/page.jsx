'use client';
import SecuredWorkspace from '../../components/secured-workspace';
import LexisProcessIntelligenceWorkspace from '../../components/lexis-process-intelligence-workspace';
export default function FasesProvasPage(){
 return <SecuredWorkspace active="Fases e provas">{({db,session})=>
  <LexisProcessIntelligenceWorkspace db={db} session={session} mode="fases"/>
 }</SecuredWorkspace>;
}
