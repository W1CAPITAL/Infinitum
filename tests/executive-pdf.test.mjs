import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {buildExecutivePdf} from '../lib/executive-pdf.mjs';
const decode=bytes=>new TextDecoder().decode(bytes);
test('PDF real: conteúdo, acentos, números ausentes e referências válidas',()=>{
 const data={headline:{total:27,ativos:20,atendimentos:null,atividades:55},timeline:[{day:'2026-11-24',count:2}],team:[{nome:'João',carteira:{total:10},atividades:{registros:3,registrosTotal:9}}]};
 const pdf=decode(buildExecutivePdf(data,{period:'Mês atual',generated:'2026-11-24T14:09:00Z'}));
 assert.ok(pdf.startsWith('%PDF-1.4'));assert.match(pdf,/\/Type \/Page\b/);
 assert.ok(pdf.includes('4A6FE36F'),'nome com acento codificado em WinAnsi');
 assert.ok(pdf.includes('4E2F44'),'valor indisponível não vira zero');
 assert.ok(pdf.includes('3535'),'55 atividades');
 const xref=Number(pdf.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.slice(xref,xref+4),'xref');
 for(const m of pdf.matchAll(/^(\d{10}) 00000 n /gm))assert.match(pdf.slice(Number(m[1]),Number(m[1])+20),/^\d+ 0 obj/);
});
test('paginação de equipe não corta nomes e registros',()=>{
 const team=Array.from({length:100},(_,i)=>({nome:'Pessoa '+i,atividades:{registros:i}}));
 const pdf=decode(buildExecutivePdf({headline:{total:100},team},{period:'Mês atual'}));
 assert.ok(Number(pdf.match(/\/Count (\d+)/)[1])>3);
 assert.ok(pdf.includes('506573736F61203939'));
 assert.throws(()=>buildExecutivePdf(null),/relat.rio/i);
});

test('PDF export uses the loaded model rather than printing a hidden screen',()=>{
 const ui=readFileSync(new URL('../components/lexis-intelligence-workspace.jsx',import.meta.url),'utf8');
 assert.match(ui,/buildExecutivePdf\(model/);
 assert.match(ui,/application\/pdf/);
 assert.doesNotMatch(ui,/window\.print\(/);
});
test('Poppler extracts the actual report and Portuguese text when installed',t=>{
 try{execFileSync('pdftotext',['-v'],{stdio:'ignore'})}catch(e){if(e.code==='ENOENT'){t.skip('Poppler unavailable');return}throw e}
 const bytes=buildExecutivePdf({headline:{total:27,ativos:20,atividades:55},team:[{nome:'João da Silva',atividades:{registros:55}}]},{period:'Mês atual'});
 const extracted=execFileSync('pdftotext',['-','-'],{input:Buffer.from(bytes),encoding:'utf8'});
 assert.match(extracted,/Relatório executivo/);assert.match(extracted,/João da Silva/);assert.match(extracted,/55/);
});

test('export includes the same detailed sections and daily closures shown on screen',()=>{
 const pdf=decode(buildExecutivePdf({headline:{total:20},team:[]},{sections:[{title:'Auditoria judicial',subtitle:'DataJud',metrics:[{label:'Procedência identificada',value:17}],note:'Fonte consultada'}],daily:[{ymd:'2026-11-24',encerramentos:4}]}));
 for(const value of ['Auditoria judicial','Procedência identificada','Encerramentos manuais por dia','Fonte consultada'])assert.ok(pdf.includes(Buffer.from(value,'latin1').toString('hex').toUpperCase()),value);
});
