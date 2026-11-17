import {officeAuth,officeJson,safeOfficeError} from '../../../../../lib/office-server.mjs';
import {OPENBOT_MCP_EDIT_FIELDS} from '../../../../../lib/openbot-mcp-edit-policy.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
async function humanWithSession(request){
 const {db,user,claims}=await officeAuth(request); // OAuth token is never permitted here.
 if(claims?.aal!=='aal2')
  throw Object.assign(Error('Confirme MFA (segundo fator) antes de revisar alterações do MausBot.'),{status:403});
 return {db,user};
}
export async function GET(request){
 try{
  const {db,user}=await officeAuth(request);
  const r=await db.from('openbot_mcp_edit_requests')
   .select('id,empresa_id,client_id,target_table,target_id,field_name,new_value,reason,status,expires_at,created_at,reviewed_at,reviewed_by,original_value,applied_value')
   .eq('owner_id',user.id).order('created_at',{ascending:false}).limit(45);
  if(r.error)throw r.error;
  return officeJson({ok:true,proposals:(r.data||[]).map(p=>({...p,
   field_label:OPENBOT_MCP_EDIT_FIELDS[p.target_table]?.[p.field_name]||p.field_name
  })),checkedAt:new Date().toISOString(),notice:'Apenas uma sessão humana com MFA pode aplicar alterações.'});
 }catch(e){return safeOfficeError(e)}
}
export async function POST(request){
 try{
  const {db}=await humanWithSession(request);
  const body=await request.json().catch(()=>({}));
  const id=String(body.proposalId||'');
  if(!uuid.test(id)||typeof body.approve!=='boolean')
   throw Object.assign(Error('Informe a proposta e uma decisão explícita de aprovar ou rejeitar.'),{status:400});
  const result=await db.rpc('openbot_review_mcp_edit',{p_id:id,p_approve:body.approve});
  if(result.error)throw Object.assign(Error('Revisão não concluída: '+result.error.message),{status:409});
  return officeJson({ok:true,review:result.data});
 }catch(e){return safeOfficeError(e)}
}
