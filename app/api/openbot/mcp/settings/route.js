import {officeAuth,officeJson,safeOfficeError} from '../../../../../lib/office-server.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const clientPattern=/^[a-zA-Z0-9._:-]{5,200}$/;
export async function GET(request){
 try{
  const {db,user,claims}=await officeAuth(request);
  const result=await db.from('openbot_mcp_grants').select('id,client_id,enabled,edit_scope,expires_at,approved_at')
   .eq('owner_id',user.id).order('approved_at',{ascending:false}).limit(30);
  if(result.error)throw result.error;
  return officeJson({ok:true,grants:result.data||[],mfaVerified:claims.aal==='aal2',
   mcpUrl:'https://agentinfinitum.vercel.app/api/openbot/mcp',
   oauthAuthorizationServer:'https://segjskjlbeydlljnefai.supabase.co/auth/v1',
   notice:'O MausBot precisa de um cliente OAuth válido neste Supabase e de autorização explícita do usuário.'});
 }catch(e){return safeOfficeError(e)}
}
export async function POST(request){
 try{
  const {db,user,claims}=await officeAuth(request);
  if(claims.aal!=='aal2')throw Object.assign(Error('Ative MFA (segundo fator) antes de aprovar um cliente MCP.'),{status:403});
  const body=await request.json().catch(()=>({}));
  const clientId=String(body.clientId||'').trim();
  if(!clientPattern.test(clientId))throw Object.assign(Error('Informe um ID público OAuth válido do MausBot.'),{status:400});
  const editScope=body.editScope==='reviewed_edit'?'reviewed_edit':'read';
  const row={owner_id:user.id,client_id:clientId,enabled:true,edit_scope:editScope,approved_at:new Date().toISOString(),
   expires_at:new Date(Date.now()+30*24*3600*1000).toISOString()};
  const result=await db.from('openbot_mcp_grants').upsert(row,{onConflict:'owner_id,client_id'})
   .select('id,client_id,enabled,edit_scope,expires_at').single();
  if(result.error||!result.data)throw Error('O banco não confirmou a autorização MCP.');
  return officeJson({ok:true,grant:result.data,notice:editScope==='reviewed_edit'?'Cliente autorizado a propor edições com revisão humana e MFA; nenhuma escrita automática.':'Cliente autorizado por 30 dias para ferramentas de leitura. Nenhum envio foi ativado.'});
 }catch(e){return safeOfficeError(e)}
}
export async function DELETE(request){
 try{
  const {db,user}=await officeAuth(request);
  const body=await request.json().catch(()=>({}));
  const id=String(body.id||'');
  if(!uuid.test(id))throw Object.assign(Error('ID de autorização inválido.'),{status:400});
  const result=await db.from('openbot_mcp_grants').delete().eq('id',id).eq('owner_id',user.id)
   .select('id').maybeSingle();
  if(result.error)throw result.error;
  if(!result.data)throw Object.assign(Error('Autorização não encontrada.'),{status:404});
  return officeJson({ok:true,notice:'Permissão MCP revogada no OpenBot.'});
 }catch(e){return safeOfficeError(e)}
}
