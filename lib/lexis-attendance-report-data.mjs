export const LEXIS_ATTENDANCE_REPORT_FIELDS='id,titulo,descricao,protocolo_ref,data_realizacao,responsavel_auth_user_id,processo_id,categoria,contato_cliente_confirmado,created_at,empresa_id';

const day=/^\d{4}-\d{2}-\d{2}$/;
const positiveInteger=value=>Number.isSafeInteger(value)&&value>0;
const recentFirst=(a,b)=>
 String(b?.data_realizacao||'').localeCompare(String(a?.data_realizacao||''))||
 String(b?.created_at||'').localeCompare(String(a?.created_at||''))||
 String(b?.id||'').localeCompare(String(a?.id||''));

export async function fetchLexisAttendanceRows(db,company,bounds,{pageSize=500,maxRows=20000}={}){
 if(!db?.from||!company)throw new Error('Empresa não identificada para o relatório.');
 if(!day.test(bounds?.start||'')||!day.test(bounds?.endExclusive||'')||bounds.start>=bounds.endExclusive)
  throw new Error('Período inválido para o relatório.');
 if(!positiveInteger(pageSize)||!positiveInteger(maxRows)||pageSize>maxRows)
  throw new Error('Paginação inválida para o relatório.');
 const rows=[];
 for(let from=0;from<=maxRows;){
  const take=Math.min(pageSize,maxRows-from+1);
  const {data,error}=await db.from('tarefas_realizadas')
   .select(LEXIS_ATTENDANCE_REPORT_FIELDS)
   .eq('empresa_id',company)
   .gte('data_realizacao',bounds.start)
   .lt('data_realizacao',bounds.endExclusive)
   .order('id',{ascending:true})
   .range(from,from+take-1);
  if(error)throw new Error('Histórico de atendimentos: '+error.message);
  const batch=data||[];
  rows.push(...batch);
  if(rows.length>maxRows)break;
  if(batch.length<take)return rows.sort(recentFirst);
  from+=batch.length;
 }
 throw new Error('Histórico de atendimentos ultrapassou o limite de segurança. Dados parciais não são exibidos como totais.');
}
