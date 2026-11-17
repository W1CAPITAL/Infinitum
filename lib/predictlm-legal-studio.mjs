import {makeStandalonePetition} from './blackhole-petitions.mjs';
const types=new Set(['peticao_inicial','contestacao','recurso','manifestacao','procuracao','contrato','relatorio','outro']);
const clip=(v,max)=>String(v??'').trim().slice(0,max);
const escapeXml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
 .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function buildPredictLmPetition({kind='manifestacao',instructions='',sourceDocument='',appealType=''}={}){
 if(!types.has(kind))throw Error('Tipo de peça não reconhecido.');
 const content=clip(instructions,6000);
 if(content.length<8)throw Error('Informe o objetivo da peça e os fatos efetivamente disponíveis.');
 return makeStandalonePetition({kind,instructions:content,
   sourceDocument:clip(sourceDocument,40000),appealType});
}
export function buildPredictLmLegalSectionPrompt({kind='manifestacao',instructions='',sourceSummary=''}={}){
 if(!types.has(kind))throw Error('Tipo de peça não reconhecido.');
 const notes=clip(instructions,5000);
 if(notes.length<8)throw Error('Descreva o trecho que precisa ser redigido.');
 const ref=clip(sourceSummary,1200);
 return [
  'REDATOR JURÍDICO LOCAL · INFINITUM / princípios de geração controlada PredictLM.',
  'Escreva uma seção de minuta de '+kind.replace(/_/g,' ')+' em português brasileiro claro e técnico apenas quando necessário.',
  'NUNCA invente fatos, números, CNJ, datas, provas, decisões, dispositivos legais, jurisprudência, precedentes, resultados ou prazos.',
  'Se um fundamento ou fato não foi fornecido, escreva [CONFERIR NOS AUTOS] em vez de preencher ou presumir.',
  'Não afirme ter pesquisado a internet, DJEN, DataJud ou tribunais.',
  'Nenhuma peça está pronta para protocolar sem revisão do advogado responsável.',
  'Não execute ações nem envie mensagens. Retorne somente uma sugestão editável.',
  'INFORMAÇÕES FORNECIDAS PELO PROFISSIONAL (não verificadas automaticamente):',
  notes,
  ref?'CONTEXTO DOCUMENTAL INFORMADO (não verificado):\n'+ref:'',
 ].filter(Boolean).join('\n\n');
}
export function createLegalDocumentHtml({title='Minuta jurídica',body=''}={}){
 const name=escapeXml(clip(title,160)),text=escapeXml(clip(body,50000));
 if(!text.trim())throw Error('A minuta está vazia.');
 return '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8">'+
  '<title>'+name+'</title><style>@page{size:A4;margin:24mm 19mm}'+
  'body{font-family:Georgia,serif;color:#111;line-height:1.7;font-size:12pt;max-width:850px;margin:auto}'+
  'h1{text-align:center;font-size:14pt}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}'+
  'footer{font-size:9pt;color:#555;border-top:1px solid #bbb;margin-top:22px;padding-top:8px}'+
  '@media print{body{margin:0}}'+
  '</style></head><body><h1>'+name+'</h1><pre>'+text+'</pre>'+
  '<footer>MINUTA INTERNA — revisão profissional obrigatória. Não protocolada.</footer></body></html>';
}
const validDate=raw=>{
 const m=String(raw).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
 if(!m)return false;
 const day=Number(m[1]),month=Number(m[2]),year=Number(m[3]);
 const d=new Date(Date.UTC(year,month-1,day));
 return d.getUTCFullYear()===year&&d.getUTCMonth()+1===month&&d.getUTCDate()===day;
};
export function createLegalTimelineSvg({events=''}={}){
 const lines=String(events||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!lines.length||lines.length>8)throw Error('Informe de 1 a 8 eventos para a linha do tempo.');
 const items=lines.map(line=>{
  if(line.length>230)throw Error('Limite de 230 caracteres por evento.');
  const sep=line.indexOf('|');
  if(sep<0)throw Error('Use DATA | descrição em cada linha.');
  const date=line.slice(0,sep).trim(),label=line.slice(sep+1).trim();
  if(!validDate(date))throw Error('A data do evento não é válida: '+date);
  if(label.length<3||label.length>170)throw Error('Descrição fora do limite.');
  return {date,label};
 });
 const height=136+items.length*96;
 const nodes=items.map((item,i)=>{
  const y=122+i*96;
  // XML is fully escaped and never contains remote content or event handlers.
  return '<circle cx="52" cy="'+y+'" r="8" fill="#6a173c"/>'+
   '<text x="78" y="'+(y-8)+'" font-size="15" font-weight="700" fill="#2b1825">'+escapeXml(item.date)+'</text>'+
   '<text x="78" y="'+(y+16)+'" font-size="13" fill="#30202c">'+escapeXml(item.label)+'</text>';
 }).join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 '+height+
  '" width="920" height="'+height+'" role="img" aria-label="Linha do tempo fornecida e não verificada">'+
  '<rect width="920" height="'+height+'" fill="#faf8f9"/>'+
  '<text x="40" y="46" font-family="Arial" font-size="24" font-weight="bold" fill="#6a173c">Linha do tempo do processo</text>'+
  '<text x="40" y="73" font-family="Arial" font-size="14" fill="#65525d">Informações fornecidas pelo operador — não verificadas nos autos</text>'+
  '<line x1="52" y1="118" x2="52" y2="'+(120+(items.length-1)*96)+'" stroke="#a9a0a4" stroke-width="3"/>'+
  '<g font-family="Arial">'+nodes+'</g>'+
  '<text x="40" y="'+(height-18)+'" font-size="12" fill="#65525d">Ilustração criada por código, não por IA de imagem; revisão profissional obrigatória.</text></svg>';
}
