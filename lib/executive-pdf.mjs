// Small, dependency-free vector PDF writer. Uses built-in Helvetica (WinAnsi),
// ASCII-only streams and exact byte offsets; never rasterizes the UI.
const W=595.28,H=841.89,M=42;
const ink='192536',muted='526177',accent='225F65',line='D9E2E8',soft='F0F5F6';
const cp1252={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
function hex(value){return Array.from(String(value??'').normalize('NFC')).map(c=>{const n=c.codePointAt(0);return (n>=32&&n<=126||n>=160&&n<=255?n:cp1252[c]??63).toString(16).padStart(2,'0').toUpperCase()}).join('')}
const rgb=color=>[0,2,4].map(i=>(parseInt(color.slice(i,i+2),16)/255).toFixed(4)).join(' ');
const num=value=>value==null||value===''||!Number.isFinite(Number(value))?'N/D':Number(value).toLocaleString('pt-BR');
const rows=v=>Array.isArray(v)?v:[];
const clean=v=>String(v??'').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim();
function wrap(text,max){const chunks=[];let row='';for(const word of clean(text).split(' ')){if(word.length>max){if(row){chunks.push(row);row=''}for(let i=0;i<word.length;i+=max)chunks.push(word.slice(i,i+max));continue}if(row&&row.length+word.length+1>max){chunks.push(row);row=word}else row+=(row?' ':'')+word}if(row)chunks.push(row);return chunks.length?chunks:['—']}
export function buildExecutivePdf(model,{period='Período selecionado',mode='report',generated=new Date().toISOString(),warnings=[]}={}){
 if(!model||typeof model.headline!=='object'||!model.headline)throw Error('Relatório ainda não disponível.');
 const title=mode==='supervision'?'Relatório de supervisão':'Relatório executivo';
 const pages=[];let ops=[],y=M;
 const text=(x,top,value,size=10,bold=false,color=ink)=>ops.push('BT /'+(bold?'F2':'F1')+' '+size+' Tf '+rgb(color)+' rg 1 0 0 1 '+x.toFixed(2)+' '+(H-top-size).toFixed(2)+' Tm <'+hex(value)+'> Tj ET');
 const rect=(x,top,w,h,color)=>ops.push(rgb(color)+' rg '+x.toFixed(2)+' '+(H-top-h).toFixed(2)+' '+w.toFixed(2)+' '+h.toFixed(2)+' re f');
 const rule=(top)=>rect(M,top,W-2*M,0.75,line);
 function start(){ops=[];rect(0,0,W,5,accent);text(M,26,'INFINITUM  /  W1 CAPITAL',10,true,accent);text(M,43,title,20,true);rule(76);y=93}
 function end(){rule(H-48);text(M,H-39,'Uso interno • Dados restritos',9,false,muted);text(W-M-38,H-39,String(pages.length+1).padStart(2,'0'),9,true,muted);pages.push(ops.join('\n'))}
 function ensure(height){if(y+height>H-66){end();start()}}
 function heading(label){ensure(46);text(M,y,label,14,true,accent);y+=24;rule(y);y+=10}
 function paragraph(value,size=10,color=muted){for(const t of wrap(value,Math.floor((W-2*M)/(size*.59)))){ensure(size+6);text(M,y,t,size,false,color);y+=size+5}y+=5}
 function kv(label,value){const lines=wrap(label,65);ensure(Math.max(26,lines.length*14+8));for(let i=0;i<lines.length;i++)text(M+3,y+i*14,lines[i],10,false,muted);text(W-M-104,y,num(value),11,true);y+=Math.max(25,lines.length*14+8);rule(y-4)}
 function row(label,value){const lines=wrap(label,70);ensure(lines.length*14+8);lines.forEach((t,i)=>text(M+3,y+i*14,t,10,false,ink));text(W-M-104,y,num(value),10,true);y+=lines.length*14+8;rule(y-3)}
 const h=model.headline;
 start();paragraph('Período: '+period+'  |  Emissão: '+new Date(generated).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}));
 paragraph('Escopo: registros disponibilizados à sessão autenticada. N/D = indicador indisponível. Carteira atual e trabalho no período são medidas distintas.');
 for(const warning of rows(warnings))paragraph('Fonte parcial: '+clean(warning));
 heading('Carteira atual');
 const metrics=[['Processos',h.total],['Ativos',h.ativos],['Encerrados',h.encerrados],['Retornos vencidos',h.vencidos]];
 for(let i=0;i<metrics.length;i+=2){ensure(70);for(let j=0;j<2;j++){const x=M+j*(W-2*M+12)/2;const w=(W-2*M-12)/2;rect(x,y,w,59,soft);text(x+12,y+8,metrics[i+j][0],10,false,muted);text(x+12,y+26,num(metrics[i+j][1]),21,true)}y+=70}
 kv('Novidades na carteira',h.novidades);kv('Sem retorno registrado',h.semRetorno);
 heading('Produtividade');
 kv('Atendimentos registrados no período',h.atendimentos);kv('Processos atendidos no período',h.processosAtendidos);kv('Atividades registradas no período',h.atividades);kv('Atividades registradas no histórico',h.atividadesHistorico);
 if(mode==='supervision')kv('Edições auditadas',h.edicoes);
 if(rows(model.timeline).length){heading('Atendimentos por dia');const max=Math.max(1,...rows(model.timeline).map(d=>Number(d.count)||0));for(const d of model.timeline){ensure(24);text(M,y,clean(d.day).split('-').reverse().join('/'),10);rect(M+94,y+3,265,9,soft);if(d.count!=null)rect(M+94,y+3,265*Math.max(0,Number(d.count)||0)/max,9,accent);text(W-M-68,y,num(d.count),10,true);y+=22}}
 for(const [label,list] of [['Situação dos processos',model.statuses],['Tribunais',model.tribunals]]){if(rows(list).length){heading(label);for(const item of list)row(item.label,item.count)}}
 if(model.analysis){heading('Auditorias e trabalho analítico');const a=model.analysis;for(const [label,key] of [['Registros analíticos','totalRegistros'],['Processos analisados','processosAnalisados'],['Processos com trabalho','processosComTrabalho'],['Trabalho interno no período','atendidosInternamenteNoPeriodo'],['Auditoria sistêmica','auditoriaSistemica'],['Auditoria documental','auditoriaDocumental'],['Triagem de réplica e provas','triagemReplicaProvas'],['Dossiês','dossiesIndividuais'],['Investigações','investigacoesExternas'],['Projetos','projetos'],['Tarefas concluídas · histórico','tarefasConcluidas'],['Tarefas concluídas · período','tarefasConcluidasPeriodo'],['Contatos declarados · período','contatosDeclaradosPeriodo']])kv(label,a[key]);for(const item of rows(a.tarefasPorPessoa))paragraph(item.nome+' — Histórico: '+num(item.total)+' | Período: '+num(item.periodo))}
 heading('Produtividade por colaborador');
 if(!rows(model.team).length)paragraph('Detalhamento de colaboradores indisponível nesta consulta.');
 for(const person of rows(model.team)){
  const name=wrap(person.nome||'Responsável não identificado',58);ensure(94+name.length*15);
  rect(M,y,W-2*M,2,line);y+=8;for(const l of name){text(M,y,l,12,true);y+=16}
  if(person.cargo)paragraph(person.cargo,9);
  const a=person.atividades||{},c=person.carteira||{},t=person.atendimentos||{},w=person.trabalho||{};
  paragraph('Carteira: '+num(c.total)+' | Ativos: '+num(c.ativos)+' | Encerrados: '+num(c.encerrados),10,ink);
  paragraph('Atendimentos: '+num(t.eventos)+' | Processos atendidos: '+num(t.processos)+' | Edições: '+num(person.edicoes?.eventos),10,ink);
  paragraph('Atividades no período: '+num(a.registros)+' | Histórico: '+num(a.registrosTotal)+' | Registros de trabalho: '+num(w.registros),10,ink);
  for(const category of rows(w.categorias))paragraph(clean(category.categoria)+': '+num(category.registros),9);
  for(const event of rows(w.entregasRecentes)){paragraph([event.data,event.titulo,event.detalhe].filter(Boolean).join(' · '),9)}
  y+=5;
 }
 heading('Fonte e metodologia');
 paragraph('Dados do Supabase compartilhado, consultados sob as permissões do usuário. Atividades, contatos declarados, atendimentos e processos distintos não devem ser somados como se fossem a mesma medida.');
 if(model.source?.consultadoEm)paragraph('Última consulta: '+clean(model.source.consultadoEm));
 end();
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
 const kids=[];for(const stream of pages){const pageId=objects.length+1,streamId=pageId+1;kids.push(pageId+' 0 R');objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+streamId+' 0 R >>');objects.push('<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream')}
 objects[1]='<< /Type /Pages /Count '+pages.length+' /Kids ['+kids.join(' ')+'] >>';
 let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+obj+'\nendobj\n'});
 const xref=pdf.length;pdf+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return new TextEncoder().encode(pdf);
}
