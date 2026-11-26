import {publicationDay,publicationLink} from './infinitum-monthly-notices.mjs';
export const PHASE_REPORT_HEADERS=['Cliente','Processo','Etapa','Situação identificada','Data do ato','Resumo / registro','Providência a conferir','Advogado','Publicação oficial'];
export const PHASE_REPORT_WIDTHS=[33,28,18,33,17,65,49,30,52];
export function phaseReportRows(rows=[]){
 return rows.filter(r=>['replica','provas'].includes(r.tipo)).map(r=>({
  client:r.cliente,cnj:r.cnj,phase:r.tipo==='replica'?'Réplica':'Provas / perícia',
  situation:r.fase,date:publicationDay(r.dataMovimento),summary:r.evidencia||r.faseCadastrada||'Sem trecho disponível',
  action:r.acao,lawyer:r.advogado,link:publicationLink(r.linkFase)
 }));
}
export function phaseReportCells(r){const [y,m,d]=String(r.date||'').split('-');return [r.client,r.cnj,r.phase,r.situation,y&&m&&d?d+'/'+m+'/'+y:'',r.summary,r.action,r.lawyer,r.link||'Link não disponível']}
