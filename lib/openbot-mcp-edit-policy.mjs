// Strict MCP change requests: an OAuth bot proposes, a human approves after MFA.
// Never accept arbitrary table names/columns/SQL from an agent.
export const OPENBOT_MCP_EDIT_FIELDS=Object.freeze({
 office_clients:Object.freeze({notes:'Nota de atendimento',next_return:'Próximo retorno',responsible:'Responsável'}),
 office_cases:Object.freeze({notes:'Observações do processo',next_review:'Próxima revisão'}),
 office_deadlines:Object.freeze({notes:'Notas da tarefa',responsible:'Responsável',priority:'Prioridade'}),
 crm_clients:Object.freeze({notes:'Notas do cliente',next_return:'Próximo retorno',assigned_to:'Responsável',priority_level:'Prioridade'})
});
const DATE_FIELDS=new Set(['next_return','next_review']);
const SHORT_FIELDS=new Set(['priority','priority_level','assigned_to','responsible']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateEditProposal(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Pedido de edição inválido.');
 const target_table=String(input.target_table||''),target_id=String(input.target_id||'');
 const field_name=String(input.field_name||''),new_value=input.new_value;
 const reason=String(input.reason||'').trim();
 const fields=OPENBOT_MCP_EDIT_FIELDS[target_table];
 if(!fields||!Object.prototype.hasOwnProperty.call(fields,field_name))
  throw Error('A tabela ou o campo não permite edição pelo MCP.');
 if(!UUID.test(target_id))throw Error('Identificador do registro inválido.');
 if(typeof new_value!=='string')throw Error('Informe o novo valor como texto.');
 if(DATE_FIELDS.has(field_name)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(new_value)||Number.isNaN(Date.parse(new_value+'T00:00:00Z'))||
   new Date(new_value+'T00:00:00Z').toISOString().slice(0,10)!==new_value)
   throw Error('Use uma data real no formato AAAA-MM-DD.');
 }else if(SHORT_FIELDS.has(field_name)){
  if(new_value.length<1||new_value.length>100||/[\x00-\x1f]/.test(new_value))
   throw Error('Valor do campo deve ter entre 1 e 100 caracteres.');
 }else if(new_value.length<1||new_value.length>2400||new_value.includes('\0'))
  throw Error('Notas devem ter entre 1 e 2400 caracteres.');
 if(reason.length<12||reason.length>480)throw Error('Justifique a mudança em 12 a 480 caracteres.');
 return {target_table,target_id,field_name,new_value,reason};
}
export function proposalSummary(proposal){
 const fields=OPENBOT_MCP_EDIT_FIELDS[proposal?.target_table];
 return {target:proposal?.target_table,label:fields?.[proposal?.field_name]||'Campo desconhecido',
  field:proposal?.field_name,newValue:proposal?.new_value,reason:proposal?.reason};
}
