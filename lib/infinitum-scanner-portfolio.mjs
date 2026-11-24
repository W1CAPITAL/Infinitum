// All authorized rows; recent scan history is deliberately a separate source.
export async function scanRows(db,table,fields,{company=null,pageSize=500,maxRows=20000}={}){
 if(!db?.from||!Number.isInteger(pageSize)||pageSize<1||!Number.isInteger(maxRows)||maxRows<1)throw Error('Consulta de carteira inválida.');
 const rows=[];
 for(let offset=0;offset<=maxRows;){
  const size=Math.min(pageSize,maxRows-offset+1);
  let q=db.from(table).select(fields);
  if(company)q=q.eq('empresa_id',company);
  const {data,error}=await q.order('id',{ascending:true}).range(offset,offset+size-1);
  if(error||!Array.isArray(data))throw Error(table+': '+(error?.message||'Resposta inválida.'));
  rows.push(...data);
  if(rows.length>maxRows)throw Error(table+': limite de segurança atingido; carteira incompleta.');
  if(data.length<size)return rows;
  offset+=data.length;
 }
 throw Error('Carteira incompleta.');
}
export function nextScanBatch(rows,checked,size){
 return rows.filter(row=>!checked.has(row.process_number)).slice(0,size);
}
