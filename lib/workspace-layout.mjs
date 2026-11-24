export function groupWorkQueue(rows=[],today=''){
 const groups=[{key:'overdue',label:'Em atraso',detail:'Pendências que ultrapassaram a data',items:[]},{key:'today',label:'Para hoje',detail:'Prioridades da data atual',items:[]},{key:'upcoming',label:'Agendadas',detail:'Compromissos e atividades com data',items:[]},{key:'undated',label:'Sem data',detail:'Organize a próxima ação',items:[]},{key:'done',label:'Concluídas',detail:'Atividades encerradas ou retornos atendidos',items:[]}];
 for(const row of rows){const key=['encerrado','atendido'].includes(row.status)?'done':row.status==='vencido'?'overdue':!row.due_on?'undated':row.due_on===today?'today':'upcoming';groups.find(g=>g.key===key).items.push(row)}
 return groups.filter(g=>g.items.length);
}
