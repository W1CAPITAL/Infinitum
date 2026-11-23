// Leitura autenticada dos snapshots do LexisPredict, dentro do INFINITUM.
// Nunca recebe empresa fornecida por URL, cliente ou filtro: identifica pelo
// vínculo auth_user_id e compara com o tenant retornado pela RPC.
import {resolveCompanyAccess} from './lexis-shared-portfolio.mjs';

export const LEXIS_PERIODS=Object.freeze([
 {id:'esta_semana',label:'Esta semana'},
 {id:'semana_passada',label:'Semana passada'},
 {id:'mes',label:'Mês atual'}
]);
const periodIds=new Set(LEXIS_PERIODS.map(p=>p.id));
const object=x=>Boolean(x)&&typeof x==='object'&&!Array.isArray(x);
const number=x=>x==null||x===''||typeof x==='boolean'||!Number.isFinite(Number(x))?null:Number(x);
const list=x=>Array.isArray(x)?x:[];
const safeString=x=>String(x??'').slice(0,200);
const errorText=(r,name)=>name+': '+String(r?.error?.message||'resposta indisponível').slice(0,180);
function checkSnapshot(response,name,empresa){
 if(response?.error){
  if(response.error?.code==='42501'||/permission denied|somente supervisor|não autorizado|not authorized/i.test(response.error.message||''))
   throw Error(name+': permissão negada. Supervisão exige perfil Supervisor ou Superadmin da empresa.');
  throw Error(errorText(response,name));
 }
 if(!object(response?.data))throw Error(name+': nenhum indicador foi devolvido; não é possível exibir totais.');
 if(response.data.empresa_id!==empresa)throw Error(name+': empresa do resultado não corresponde à sessão autenticada.');
 return response.data;
}
export async function loadLexisIntelligence(db,userId,{period='mes',area='report'}={}){
 if(!db||!userId)throw Error('Sessão autenticada necessária.');
 if(!periodIds.has(period))throw Error('Período inválido.');
 if(!['report','supervision'].includes(area))throw Error('Área inválida.');
 const {data:profiles,error:profileError}=await db.from('usuarios')
  .select('auth_user_id,empresa_id,nome').eq('auth_user_id',userId).limit(2);
 if(profileError)throw Error('Não foi possível verificar a empresa: '+String(profileError.message||profileError).slice(0,180));
 const profile=resolveCompanyAccess(profiles||[],userId);
 if(!profile)throw Error('Sem vínculo único com uma empresa autorizada.');
 // As RPCs já resolvem empresa e funções no Supabase com auth.uid().
 // Sem service_role, sem parâmetros p_empresa e sem acesso a outra empresa.
 if(area==='report'){
  const result=await db.rpc('lexis_desktop_relatorio_snapshot',{p_periodo:period,p_owner:null});
  return {report:checkSnapshot(result,'Relatório',profile.empresa_id),supervision:null,
   companyId:profile.empresa_id,warnings:[]};
 }
 const [s,r]=await Promise.all([
  db.rpc('lexis_desktop_supervisao_snapshot',{p_periodo:period}),
  db.rpc('lexis_desktop_relatorio_snapshot',{p_periodo:period,p_owner:null})
 ]);
 // Se não é supervisor, não expor os relatórios da empresa nem como fallback.
 const supervision=checkSnapshot(s,'Supervisão',profile.empresa_id);
 let report=null,warnings=[];
 try{report=checkSnapshot(r,'Relatório',profile.empresa_id);}
 catch(error){warnings=[String(error?.message||error).slice(0,190)];}
 return {supervision,report,companyId:profile.empresa_id,warnings};
}
export function summarizeLexisSnapshots({report=null,supervision=null}={}){
 const current=object(supervision?.carteira)?supervision.carteira:
  object(report?.portfolio)?report.portfolio:{};
 const history=object(report?.historico)?report.historico:{};
 const activity=object(supervision?.atividade)?supervision.atividade:{};
 const team=list(report?.equipe?.pessoas).filter(object).map(x=>({
  userId:safeString(x.userId),nome:safeString(x.nome||'Responsável'),
  cargo:safeString(x.cargo||''),carteira:object(x.carteira)?x.carteira:{},
  atendimentos:object(x.atendimentos)?x.atendimentos:{},
  edicoes:object(x.edicoes)?x.edicoes:{},
  encerramentos:object(x.encerramentos)?x.encerramentos:{},
  atividades:object(x.atividades)?x.atividades:{},
  trabalho:object(x.trabalho)?x.trabalho:{}
 }));
 const timeline=list(history.dias).filter(object).map(x=>({
  day:safeString(x.day||x.ymd),count:number(x.atendimentos)
 })).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.day));
 const sortValues=xs=>list(xs).filter(object).map(x=>({
  label:safeString(x.label||'Sem identificação'),count:number(x.value)
 })).filter(x=>x.count!==null).sort((a,b)=>b.count-a.count);
 return {
  headline:{
   total:number(current.total),ativos:number(current.ativos),
   encerrados:number(current.encerrados),vencidos:number(current.vencidos),
   novidades:number(current.novidades),semRetorno:number(current.semRetorno??report?.retorno?.nuncaRegistrado),
   atendimentos:number(history.eventos),processosAtendidos:number(history.processos),
   atividades:number(report?.trabalho?.registros),edicoes:number(activity.edicoesEventos),
   cumprimentos:number(current.cumprimento??current.cumprimentos)
  },
  timeline,team,statuses:sortValues(supervision?.carteira?.porStatus),
  tribunals:sortValues(supervision?.carteira?.porTribunal),
  byUser:list(supervision?.carteira?.porUsuario).filter(object),
  source:{consultadoEm:current.consultadoEm||report?.historico?.atualizadoEm||null,
   periodo:history.periodo||report?.equipe?.periodo||null}
 };
}
function csvCell(v){
 const raw=v==null?'':String(v);
 const protectedValue=/^[\s]*[=+@\-]/.test(raw)?"'"+raw:raw;
 return '"'+protectedValue.replace(/"/g,'""')+'"';
}
export function toLexisIntelligenceCsv(snapshot,period){
 const lines=[['Indicador','Valor']];
 const h=snapshot?.headline||{};
 for(const [label,key] of [['Total de processos','total'],['Processos ativos','ativos'],['Encerrados','encerrados'],
  ['Vencidos','vencidos'],['Novidades','novidades'],['Sem retorno registrado','semRetorno'],
  ['Atendimentos no período','atendimentos'],['Processos atendidos','processosAtendidos'],
  ['Atividades registradas','atividades'],['Edições auditadas','edicoes']]){
  lines.push([label,h[key]??'']);
 }
 lines.push(['Período',period],[],['Responsável','Carteira','Atendimentos registrados']);
 for(const person of snapshot?.team||[]){
  lines.push([person.nome,person.carteira?.total??'',person.atendimentos?.eventos??'']);
 }
 // BOM keeps pt-BR accents in spreadsheet viewers; values remain quoted and
 // dangerous leading spreadsheet formula characters are neutralized.
 return '\uFEFF'+lines.map(values=>values.map(csvCell).join(';')).join('\r\n');
}
