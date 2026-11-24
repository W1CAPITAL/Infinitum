// Navegação jurídica: não exibe cadastros antigos de quitações.
export const CRM_AREAS=Object.freeze([
 {label:'Painel jurídico',key:'visao',path:'/'},
 {label:'Processos',key:'processos',path:'/processos'},
 {label:'Encerrados',key:'encerrados',path:'/encerrados'},
 {label:'Atividades',key:'atividades',path:'/atividades'},
 {label:'Análises internas',key:'analises-internas',path:'/analises-internas'},
 {label:'Scanner judicial',key:'scanner',path:'/scanner'},
 {label:'Tarefas',key:'tarefas',path:'/tarefas'},
 {label:'Vencidos',key:'vencidos',path:'/vencidos'},
 {label:'Supervisão',key:'supervisao',path:'/supervisao'},
 {label:'Fases e provas',key:'fases-provas',path:'/fases-provas'},
 {label:'Processos parados',key:'processos-parados',path:'/processos-parados'},
 {label:'Fluxos (POP)',key:'fluxos',path:'/fluxos'},
 {label:'Audiências',key:'audiencias',path:'/audiencias'},
 {label:'Agenda',key:'agenda',path:'/agenda'},
 {label:'Peças e petições',key:'pecas',path:'/pecas'},
 {label:'WhatsApp',key:'whatsapp',path:'/whatsapp'},
 {label:'Leads',key:'leads',path:'/leads'},
 {label:'Gerador de processos',key:'gerador-processos',path:'/gerador-processos'},
 {label:'Superagente',key:'superagente',path:'/superagente'},
 {label:'Mini Agentes',key:'agentes',path:'/agentes'},
 {label:'Relatórios',key:'relatorios',path:'/relatorios'},
 {label:'Integrações',key:'integracoes',path:'/integracoes'},
 {label:'Configurações',key:'configuracoes',path:'/configuracoes'}
]);
export function crmAreaHref(label){if(label==='Clientes')return '/processos';if(label==='Prazos')return '/agenda?tipo=prazo';return CRM_AREAS.find(x=>x.label===label)?.path||'/'}
export function areaFromQuery(query=''){
 const v=new URLSearchParams(String(query).replace(/^\?/,'')).get('aba');
 if(v==='clientes')return 'Processos';if(v==='prazos')return 'Agenda';
 return CRM_AREAS.find(x=>x.key===v)?.label||'Painel jurídico';
}

const sections=[
 ['Visão geral',[
 ['visao','Visão geral','Indicadores, prioridades e próximos compromissos','dashboard painel indicadores kpi'],
 ['supervisao','Supervisão','Acompanhamento da equipe e da carteira','gestao colaboradores equipe'],
 ['relatorios','Relatórios','Produtividade, resultados e histórico','exportar pdf dados']]]
 ,['Rotina de trabalho',[
 ['processos','Processos','Carteira, dados cadastrais e atendimentos','cliente clientes cadastro cpf cnj atendimento'],
 ['tarefas','Tarefas e retornos','Atividades a realizar e contato com clientes','pendencia retorno atendimento'],
 ['agenda','Agenda e prazos','Calendário, compromissos e prazos jurídicos','prazo vencimento calendario'],
 ['vencidos','Vencidos','Pendências que ultrapassaram a data','atraso urgente'],
 ['audiencias','Audiências','Compromissos judiciais com data definida','conciliacao instrucao sessao'],
 ['atividades','Atividades realizadas','Registro e histórico do trabalho concluído','historico produtividade'],
 ['encerrados','Encerrados','Processos encerrados na carteira','arquivado concluido']]]
 ,['Inteligência jurídica',[
 ['scanner','Scanner judicial','Consultar movimentações e publicações','djen datajud tribunal'],
 ['fases-provas','Fases e provas','Acompanhar instrução e pendências probatórias','prova fase'],
 ['processos-parados','Processos parados','Identificar casos que precisam de revisão','inatividade'],
 ['analises-internas','Análises internas','Anotações e avaliações da operação','analise'],
 ['pecas','Peças e petições','Criar documentos a partir do processo','peticao minuta recurso procuracao'],
 ['fluxos','Procedimentos','Rotinas e procedimentos do escritório','pop fluxo'],
 ['gerador-processos','Gerador de processos','Organizar buscas e novos registros','gerador']]]
 ,['Comunicação e automação',[
 ['whatsapp','WhatsApp','Conversas e atendimento','mensagem comunicacao'],
 ['leads','Leads','Oportunidades e contatos comerciais','prospeccao'],
 ['superagente','Superagente','Assistente de inteligência artificial','ia assistente'],
 ['agentes','Agentes','Ferramentas de apoio à operação','mini agentes automacao openbot killa hermes atlas nox vega lyra oraculo']]]
 ,['Administração',[
 ['integracoes','Integrações','Conectar serviços e ferramentas','api conexao'],
 ['configuracoes','Configurações','Perfil, aparência e preferências','tema conta senha']]]
];
export const CRM_NAV_GROUPS=Object.freeze(sections.map(([label,items])=>({label,items:items.map(([key,name,description,keywords])=>({...CRM_AREAS.find(a=>a.key===key),name,description,keywords}))})));
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function searchCrmAreas(query){
 const q=norm(query);if(!q)return [];
 return CRM_NAV_GROUPS.flatMap(g=>g.items).map(item=>({item,score:norm(item.name).includes(q)||norm(item.label).includes(q)?3:norm(item.keywords).includes(q)?2:norm(item.description).includes(q)?1:0})).filter(x=>x.score).sort((a,b)=>b.score-a.score).map(x=>x.item).slice(0,8);
}

export function isNavGroupOpen(label,activeKey,collapsed=[]){
 const group=CRM_NAV_GROUPS.find(g=>g.label===label);
 return !!group&&(group.items.some(item=>item.key===activeKey)||!collapsed.includes(label));
}

export function resolveWorkspaceGroup(path,activeKey,selection){
 if(selection?.path===path&&CRM_NAV_GROUPS.some(g=>g.label===selection.label))return selection.label;
 return CRM_NAV_GROUPS.find(g=>g.items.some(i=>i.key===activeKey))?.label||CRM_NAV_GROUPS[0].label;
}
