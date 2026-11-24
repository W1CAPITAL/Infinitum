// Adaptação dos painéis do /report do LexisPredict ao snapshot autenticado.
const list=x=>Array.isArray(x)?x:[];
const num=x=>x==null||typeof x==='boolean'||String(x).trim()===''||!Number.isFinite(Number(x))?null:Number(x);
const fmt=x=>num(x)==null?'indisponível':num(x).toLocaleString('pt-BR');
const metric=(label,v)=>({label,value:num(v)});
const fields=(source,entries)=>entries.map(([label,key])=>metric(label,source?.[key]));
export function buildReportSections(report={}){
 const m=report.merito?.oficial,d=report.desfechos,r=report.retorno,c=report.encerramentos,w=report.trabalho,h=report.historico;
 return [
 {id:'merito',title:'Resultado dos processos encerrados',subtitle:'Auditoria judicial · CNJ / DataJud',note:'Movimentos oficiais não comprovam trânsito em julgado nem eventual reforma. Encerramento no CRM é administrativo.',metrics:fields(m,[['Encerrados no CRM','encerrados'],['Procedência identificada','procedentes'],['Procedência parcial identificada','parciais'],['Improcedência identificada','improcedentes'],['Resultados divergentes','divergentes'],['Sem mérito','sem_merito'],['Acordos','acordos'],['Iniciais indeferidas','indeferimentos'],['Distribuição cancelada','cancelamentos'],['Desistência','desistencias'],['Abandono','abandonos'],['A esclarecer','nao_determinados'],['Não localizados','nao_localizados']])},
 {id:'desfechos',title:'Desfechos e cumprimento',subtitle:'Informações registradas na carteira',note:'Relatos de recebimento e falta de comprovante não confirmam pagamento ou ausência dele.',metrics:fields(d,[['Outras saídas formais','outros_formais'],['Cumprimento encerrado indicado','cumprimentos_encerrados_indicados'],['Relatos de recebimento','recebimento_relatado'],['Sem comprovante no registro','sem_comprovacao_recebimento'],['Falta de retorno mencionada','falta_retorno_mencionada']])},
 {id:'retornos',title:'Retornos dos processos ativos',subtitle:'Acompanhamento da carteira',note:'Nunca registrado e antigo são recortes do retorno prolongado, não indicadores adicionais a somar.',metrics:fields(r,[['Sem retorno há 30 dias ou mais','semRetornoLongo'],['Nunca tiveram retorno registrado','nuncaRegistrado'],['Último retorno antigo (30+ dias)','antigos']])},
 {id:'encerramentos',title:'Encerramentos registrados no período',subtitle:'Auditoria das ações manuais',note:'Testes administrativos não são atendimentos; ações repetidas não representam processos distintos.',metrics:fields(c,[['Processos encerrados manualmente','processosManuais'],['Encerramentos manuais registrados','encerramentosManuais'],['Permanecem encerrados','manuaisPermanecemEncerrados'],['Encerramentos administrativos de teste','testesAdministrativos'],['Testes com reversão','testesRevertidos'],['Testes sem reversão registrada','testesSemReversao']]),columns:['Responsável','Processos','Eventos','Ainda encerrados'],rows:list(c?.porUsuario).map(x=>[x.nome,num(x.processos),num(x.eventos),num(x.permanecemEncerrados)])},
 {id:'trabalho',title:'Investigações, auditorias e atividades internas',subtitle:'Trabalho cadastrado no período',note:'Registros operacionais não comprovam contato com cliente; auditorias em lote não são trabalho manual individual.',metrics:fields(w,[['Registros de trabalho interno','registros'],['Processos distintos analisados','processosDistintos'],['Contatos confirmados','comContatoConfirmado'],['Testes internos em lote','testes'],['Testes com reversão','testesRevertidos']]),columns:['Tipo de trabalho','Registros','Processos'],rows:list(w?.porCategoria).map(x=>[String(x.categoria||'Não informado').replaceAll('_',' '),num(x.registros),num(x.processos)]),secondary:{columns:['Responsável','Registros','Processos'],rows:list(w?.porUsuario).map(x=>[x.nome,num(x.registros),num(x.processos)])}},
 {id:'edicoes',title:'Atendimentos e edições auditadas',subtitle:'Histórico do período selecionado',note:'Edições manuais, contatos e atividades são fontes distintas.',metrics:[...fields(h,[['Processos atendidos','processos'],['Atendimentos registrados','eventos']]),...fields(h?.edicoes,[['Processos editados','processos'],['Editados hoje','hoje'],['Eventos de edição','eventos']])]}
 ];
}
export function executiveSeries(history={}){
 const byDay=new Map(),has=Array.isArray(history.porUsuarioDia);
 if(has)for(const row of history.porUsuarioDia){const day=String(row.ymd||row.day||'');const n=num(row.encerramentos);if(n==null)byDay.set(day,null);else if(byDay.get(day)!==null)byDay.set(day,(byDay.get(day)||0)+n);}
 return list(history.dias).map(d=>{const ymd=String(d.ymd||d.day||'');return {ymd,atendimentos:num(d.atendimentos),encerramentos:has?(byDay.has(ymd)?byDay.get(ymd):0):null}}).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d.ymd)).sort((a,b)=>a.ymd.localeCompare(b.ymd));
}
export function reportDistribution(h={}){
 const total=num(h.total),a=num(h.ativos),c=num(h.encerrados);
 if(total==null||a==null||c==null||total<0||a<0||c<0||a+c>total)return null;
 return [{label:'Ativos',value:a,color:'#0c9b91'},{label:'Encerrados no CRM',value:c,color:'#6267bc'},{label:'Outros estados',value:total-a-c,color:'#bfc5d1'}];
}
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function answerReportQuestion(question,model,sections){
 const q=norm(question),h=model?.headline||{},people=list(model?.team);
 if(!q)return 'Digite uma pergunta sobre os dados deste relatório.';
 const exact=people.filter(p=>norm(p.nome).length>2&&q.includes(norm(p.nome)));
 const matching=exact.length?exact:people.filter(p=>{const first=norm(p.nome).split(/\s+/)[0];return first.length>2&&q.split(/\W+/).includes(first)});
 if(matching.length>1)return 'Há mais de um colaborador com esse nome. Informe o nome completo.';
 if(matching.length===1){const p=matching[0];return p.nome+': '+fmt(p.atendimentos?.eventos)+' registros de atendimento, '+fmt(p.atendimentos?.processos)+' processos atendidos, '+fmt(p.edicoes?.processos)+' processos editados, '+fmt(p.encerramentos?.processos)+' encerramentos e '+fmt(p.atividades?.registrosTotal)+' atividades cadastradas no histórico. Essas fontes não devem ser somadas.'}
 const describe=id=>{const s=list(sections).find(x=>x.id===id);return s?s.title+': '+s.metrics.map(m=>m.label+': '+fmt(m.value)).join('; ')+'. '+s.note:'Dados indisponíveis.'};
 if(/prioridade|atencao|risco|vencid|atrasad/.test(q))return 'Vencidos no CRM: '+fmt(h.vencidos)+'. '+describe('retornos')+' '+describe('merito');
 if(/merito|sentenca|proceden|julgamento/.test(q))return describe('merito');
 if(/encerr|cumprimento/.test(q))return describe('encerramentos')+' '+describe('desfechos');
 if(/investig|auditor|trabalho|atividad/.test(q))return describe('trabalho')+' Atividades cadastradas no histórico: '+fmt(h.atividadesHistorico)+'.';
 if(/retorno/.test(q))return describe('retornos');
 if(/atend|edit|produtiv/.test(q))return describe('edicoes');
 return 'Carteira disponível: '+fmt(h.total)+' processos; ativos: '+fmt(h.ativos)+'; encerrados: '+fmt(h.encerrados)+'. Atendimentos no período: '+fmt(h.atendimentos)+'. Consulte também mérito, encerramentos, auditorias, retornos ou o nome de um colaborador. Respostas limitadas aos dados desta consulta.';
}
