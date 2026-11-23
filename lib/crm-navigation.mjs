// Navegação jurídica: não exibe cadastros antigos de quitações.
export const CRM_AREAS=Object.freeze([
 {label:'Painel jurídico',key:'visao',path:'/'},
 {label:'Clientes',key:'clientes',path:'/clientes'},
 {label:'Processos',key:'processos',path:'/processos'},
 {label:'Encerrados',key:'encerrados',path:'/encerrados'},
 {label:'Atividades',key:'atividades',path:'/atividades'},
 {label:'Análises internas',key:'analises-internas',path:'/analises-internas'},
 {label:'Scanner judicial',key:'scanner',path:'/scanner'},
 {label:'Prazos',key:'prazos',path:'/prazos'},
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
export function crmAreaHref(label){return CRM_AREAS.find(x=>x.label===label)?.path||'/'}
export function areaFromQuery(query=''){
 const v=new URLSearchParams(String(query).replace(/^\?/,'')).get('aba');
 return CRM_AREAS.find(x=>x.key===v)?.label||'Painel jurídico';
}
