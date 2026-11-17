import {officeAuth,officeJson,safeOfficeError} from '../../../../lib/office-server.mjs';
import {connectorCatalog} from '../../../../lib/openbot-connectors.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request){
 try{
  const {db,user}=await officeAuth(request);
  const result=await db.from('openbot_connections')
   .select('id,provider,external_account_id,display_name,email,scopes,status,expires_at,last_checked_at,created_at')
   .eq('owner_id',user.id).order('created_at',{ascending:false}).limit(70);
  if(result.error)throw Object.assign(Error('Conexões indisponíveis: '+result.error.message),{status:503});
  return officeJson({ok:true,connectors:connectorCatalog(),accounts:result.data||[],
   notice:'O status conectado significa que a autorização foi salva, não que o provedor garante disponibilidade. Verifique com Testar acesso.'});
 }catch(e){return safeOfficeError(e)}
}
export async function DELETE(request){
 try{
  const {db,user}=await officeAuth(request);
  const body=await request.json().catch(()=>({}));
  const id=String(body.id||'');
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))
   throw Object.assign(Error('Conta inválida.'),{status:400});
  const result=await db.from('openbot_connections').delete().eq('id',id).eq('owner_id',user.id)
   .select('id,provider,display_name').maybeSingle();
  if(result.error)throw result.error;
  if(!result.data)throw Object.assign(Error('Conta não encontrada ou sem acesso.'),{status:404});
  return officeJson({ok:true,removed:{id:result.data.id,provider:result.data.provider},
   notice:'Autorização removida do OpenBot. Para revogação completa no provedor, use também as permissões da sua conta Google/Meta.'});
 }catch(e){return safeOfficeError(e)}
}
