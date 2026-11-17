// Fonte única do KPI de atendimento: auditoria de ações manuais da carteira Lexis.
// Não confundir com retorno agendado concluído por datas ou mensagens automáticas.
const integer=(raw,label)=>{
 const n=typeof raw==='number'?raw:Number(raw);
 if(!Number.isSafeInteger(n)||n<0)throw Error('Contagem inválida na auditoria: '+label);
 return n;
};
const str=(v,max=160)=>String(v??'').trim().slice(0,max);
const day=/^\d{4}-\d{2}-\d{2}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanOperator=x=>{
 const id=str(x?.userId,40),name=str(x?.nome,160);
 if(!uuid.test(id)||!name)throw Error('Operador inválido na auditoria.');
 return {userId:id,nome:name,processos:integer(x.processos,'processos do operador'),
  eventos:integer(x.eventos,'eventos do operador')};
};
export function normalizeLexisAttendanceAudit(raw,{today,userId}={}){
 const payload=typeof raw==='string'?JSON.parse(raw):raw;
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('A auditoria retornou um formato inválido.');
 const reference=str(today||payload.hoje,10);
 if(!day.test(reference)||payload.hoje!==reference)throw Error('A data da auditoria não corresponde a hoje em São Paulo.');
 if(!Array.isArray(payload.dias)||!Array.isArray(payload.hojePorUsuario)||!Array.isArray(payload.porUsuario))
  throw Error('A auditoria não retornou os indicadores necessários.');
 const todayRow=payload.dias.find(x=>x?.ymd===reference);
 if(!todayRow)throw Error('A auditoria não retornou o total de processos de hoje.');
 const todayTotal=integer(todayRow.atendimentos,'total diário');
 const operatorsToday=payload.hojePorUsuario.map(cleanOperator).filter(x=>x.processos>0)
  .sort((a,b)=>b.processos-a.processos||a.nome.localeCompare(b.nome,'pt-BR'));
 const operatorsPeriod=payload.porUsuario.map(cleanOperator).filter(x=>x.processos>0)
  .sort((a,b)=>b.processos-a.processos||a.nome.localeCompare(b.nome,'pt-BR'));
 const seen=new Set();
 for(const op of operatorsToday){
  if(seen.has(op.userId))throw Error('A auditoria repetiu o mesmo operador.');
  seen.add(op.userId);
 }
 if(operatorsToday.reduce((sum,x)=>sum+x.processos,0)<todayTotal)
  throw Error('O total de hoje não confere com a soma mínima dos operadores.');
 const me=operatorsToday.find(x=>x.userId===userId)||null;
 return {today:reference,todayTotal,operatorsToday,operatorsPeriod,
  personalToday:me?.processos??0,personalEvents:me?.eventos??0,
  // Um processo pode ser atendido por pessoas diferentes no mesmo dia.
  overlapPossible:operatorsToday.reduce((sum,x)=>sum+x.processos,0)!==todayTotal,
  recordedAt:str(payload.atualizadoEm,40),source:'lexis_atendimentos_periodo'};
}
export async function fetchLexisAttendanceAudit(db,company,{userId,today,period='esta_semana'}={}){
 if(!db?.rpc||!uuid.test(str(company,40)))throw Error('Organização não validada para consulta de atendimento.');
 if(period!=='esta_semana')throw Error('Período de atendimento inválido para este painel.');
 const {data,error}=await db.rpc('lexis_atendimentos_periodo',{p_empresa:company,p_periodo:period});
 if(error)throw Error('Não foi possível consultar a auditoria de atendimentos: '+str(error.message,220));
 return normalizeLexisAttendanceAudit(data,{userId,today});
}
