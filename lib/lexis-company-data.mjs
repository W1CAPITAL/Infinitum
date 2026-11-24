// Indicadores da empresa exigem paginação completa; PostgREST não deve ser truncado em 500 registros.
export const COMPANY_SOURCES={
 processes:['processos','id,empresa_id,cliente,protocolo_ref,ultimo_retorno,proximo_retorno,proximo_prazo,status,status_interno,statusManual:dados->>statusManual,situacao:dados->>situacao,atendido_por,observacoes,advogado,tribunal,created_at,updated_at'],
 hearings:['audiencias_monitoradas','id,empresa_id,processo_id,cliente,protocolo_ref,advogado,tribunal,tipo,data_evento,data_fim,hora_local,hora_fim,fuso,modalidade,situacao,fonte,fonte_url,portal_url,evidencia'],
 tasks:['crm_tarefas','id,empresa_id,titulo,feito,due_at,assignee_id'],
 manual:['office_deadlines','id,empresa_id,title,due_on,kind,status,priority,notes,responsible']
};
const pendingByClient=new WeakMap();
export async function fetchCompanyRows(db,table,columns,company,{pageSize=500,maxRows=20000}={}){
 if(!company)throw new Error('Empresa não identificada.');
 if(!Number.isInteger(pageSize)||pageSize<1||!Number.isInteger(maxRows)||maxRows<1)throw new Error('Limite de paginação inválido.');
 let pending=pendingByClient.get(db);
 if(!pending){pending=new Map();pendingByClient.set(db,pending)}
 const key=JSON.stringify([table,columns,company,pageSize,maxRows]);
 if(pending.has(key))return pending.get(key);
 const work=readCompanyRows(db,table,columns,company,pageSize,maxRows);
 pending.set(key,work);
 try{return await work}finally{if(pending.get(key)===work)pending.delete(key)}
}
async function readCompanyRows(db,table,columns,company,pageSize,maxRows){
 if(!company)throw new Error('Empresa não identificada.');
 const rows=[];
 for(let from=0;from<=maxRows;){
  const size=Math.min(pageSize,maxRows-from+1);
  const {data,error}=await db.from(table).select(columns).eq('empresa_id',company).order('id',{ascending:true}).range(from,from+size-1);
  if(error)throw new Error(table+': '+error.message);
  const batch=data||[];rows.push(...batch);
  if(rows.length>maxRows)break;
  if(batch.length<size)return rows;
  from+=batch.length;
 }
 throw new Error('Consulta '+table+' ultrapassou o limite de segurança. Dados parciais não são exibidos como totais.');
}
export async function loadLexisCompanySources(db,company){
 const names=Object.keys(COMPANY_SOURCES);
 const res=await Promise.allSettled(names.map(name=>fetchCompanyRows(db,...COMPANY_SOURCES[name],company)));
 const sources={processes:[],hearings:[],tasks:[],manual:[]},errors=[];
 res.forEach((item,i)=>{const name=names[i];if(item.status==='fulfilled')sources[name]=item.value;
 else errors.push(name+': '+String(item.reason?.message||item.reason));});
 return {sources,errors,valid:Object.fromEntries(names.map((name,i)=>[name,res[i].status==='fulfilled']))};
}
