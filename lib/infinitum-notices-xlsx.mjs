import {NOTICE_HEADERS,NOTICE_WIDTHS,noticeCells,publicationLink} from './infinitum-monthly-notices.mjs';
import {PHASE_REPORT_HEADERS,PHASE_REPORT_WIDTHS,phaseReportCells} from './infinitum-phase-report.mjs';
const enc=s=>new TextEncoder().encode(s);
const xml=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const head='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships',pr='http://schemas.openxmlformats.org/package/2006/relationships';
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function zip(files){
 const parts=[],central=[];let offset=0,total=0;
 for(const [name,content] of Object.entries(files)){
  const n=enc(name),data=enc(content),crc=crc32(data);
  const local=new Uint8Array(30+n.length),l=new DataView(local.buffer);
  l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(12,33,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,n.length,true);local.set(n,30);
  const entry=new Uint8Array(46+n.length),e=new DataView(entry.buffer);
  e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x800,true);e.setUint16(14,33,true);e.setUint32(16,crc,true);e.setUint32(20,data.length,true);e.setUint32(24,data.length,true);e.setUint16(28,n.length,true);e.setUint32(42,offset,true);entry.set(n,46);
  parts.push(local,data);central.push(entry);offset+=local.length+data.length;total+=entry.length;
 }
 const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,total,true);v.setUint32(16,offset,true);
 const output=new Uint8Array(offset+total+end.length);let at=0;for(const p of [...parts,...central,end]){output.set(p,at);at+=p.length}return output;
}
export function buildNoticesXlsx(rows=[],{kind='notices'}={}){
 const phases=kind==='phases',headers=phases?PHASE_REPORT_HEADERS:NOTICE_HEADERS,widths=phases?PHASE_REPORT_WIDTHS:NOTICE_WIDTHS;
 const values=[headers,...rows.map(phases?phaseReportCells:noticeCells)],links=[],relationships=[];
 const data=values.map((cells,i)=>{
  const row=i+1,href=i?publicationLink(rows[i-1].link):'';
  if(href){const id='rId'+(relationships.length+1);relationships.push('<Relationship Id="'+id+'" Type="'+rel+'/hyperlink" Target="'+xml(href)+'" TargetMode="External"/>');links.push('<hyperlink ref="I'+row+'" r:id="'+id+'"/>')}
  return '<row r="'+row+'" ht="'+(i?54:30)+'" customHeight="1">'+cells.map((value,j)=>'<c r="'+String.fromCharCode(65+j)+row+'" s="'+(!i?1:j===8&&href?4:i%2?2:3)+'" t="inlineStr"><is><t xml:space="preserve">'+xml(String(value??'').slice(0,32767))+'</t></is></c>').join('')+'</row>';
 }).join('');
 const range='A1:I'+values.length;
 const styles=head+'<styleSheet xmlns="'+ns+'"><fonts count="3"><font><sz val="11"/><name val="Calibri"/><color rgb="FF29262D"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font><font><u/><sz val="11"/><name val="Calibri"/><color rgb="FF24578A"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF792840"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0EEEB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
 const files={
 '[Content_Types].xml':head+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
 '_rels/.rels':head+'<Relationships xmlns="'+pr+'"><Relationship Id="rId1" Type="'+rel+'/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':head+'<workbook xmlns="'+ns+'" xmlns:r="'+rel+'"><sheets><sheet name="'+(phases?'Réplica e provas':'Intimações')+'" sheetId="1" r:id="rId1"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels':head+'<Relationships xmlns="'+pr+'"><Relationship Id="rId1" Type="'+rel+'/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="'+rel+'/styles" Target="styles.xml"/></Relationships>',
 'xl/styles.xml':styles,
 'xl/worksheets/sheet1.xml':head+'<worksheet xmlns="'+ns+'" xmlns:r="'+rel+'"><dimension ref="'+range+'"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>'+widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols><sheetData>'+data+'</sheetData><autoFilter ref="'+range+'"/>'+(links.length?'<hyperlinks>'+links.join('')+'</hyperlinks>':'')+'</worksheet>'
 };
 if(relationships.length)files['xl/worksheets/_rels/sheet1.xml.rels']=head+'<Relationships xmlns="'+pr+'">'+relationships.join('')+'</Relationships>';
 return zip(files);
}
