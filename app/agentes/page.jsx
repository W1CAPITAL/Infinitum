'use client';
import SecuredWorkspace from '../../components/secured-workspace';
import AgentsCommandCenter from '../../components/agents-command-center';
export default function Page(){return <SecuredWorkspace active="OpenBot" fullscreen>{({db,session})=><AgentsCommandCenter db={db} session={session}/>}</SecuredWorkspace>}
