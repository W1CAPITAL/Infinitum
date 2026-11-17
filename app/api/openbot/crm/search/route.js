import {officeAuth,officeJson,safeOfficeError} from '../../../../../lib/office-server.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const strip=text=>String(text||'').replace(/[^\p{L}\p{N} .-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,80);
const limited=(rows,source)=>Array.isArray(rows)?rows.slice(0,12).map(x=>({...x,source})):[];
export async function GET(request){
 try{
  const {db,user}=await officeAuth(request);
  const url=new URL(request.url),q=strip(url.searchParams.get('q'));
  if(q.length<3)throw Object.assign(Error('Digite pelo menos três caracteres do cliente ou processo.'),{status:400});
  const like='%'+q.replace(/[%_]/g,'')+'%';
  const profiles=await db.from('usuarios').select('empresa_id').eq('auth_user_id',user.id).limit(2);
  const empresa=profiles.error||profiles.data?.length!==1?null:profiles.data[0]?.empresa_id;
  const fetches=[
   db.from('office_clients').select('id,name,status,next_return').eq('owner_id',user.id)
    .ilike('name',like).limit(12),
   db.from('office_cases').select('id,client_id,title,process_number,status,tribunal,next_review').eq('owner_id',user.id)
    .ilike('process_number',like).limit(12)
  ];
  if(empresa){
   fetches.push(db.from('crm_clients').select('id,name,stage,next_return').eq('empresa_id',empresa)
    .ilike('name',like).limit(12));
   fetches.push(db.from('crm_processes').select('id,process_number,process_type,client_id').eq('empresa_id',empresa)
    .ilike('process_number',like).limit(12));
  }
  const results=await Promise.allSettled(fetches);
  const labels=['Clientes do escritório','Processos do escritório','Clientes do CRM','Processos do CRM'];
  const clients=[],cases=[],errors=[];
  results.forEach((r,i)=>{
   if(r.status==='rejected'||r.value?.error){errors.push(labels[i]+': consulta não concluída');return}
   (i%2===0?clients:cases).push(...limited(r.value.data,labels[i]));
  });
  // Failed requests are explicitly recorded; never transform an access error into "0 cases".
  return officeJson({ok:true,query:q,clients:clients.slice(0,24),cases:cases.slice(0,24),partial:errors.length>0,
   errors,asOf:new Date().toISOString(),
   notice:'Resultados do CRM autorizado. Não são consultas judiciais em tempo real.'});
 }catch(e){return safeOfficeError(e)}
}
