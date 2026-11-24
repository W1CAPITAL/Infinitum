import test from 'node:test';import assert from 'node:assert/strict';import{splitDjenCalendarMonths}from'../lib/judicial-history-client.mjs';test('meses com no maximo 31 dias',()=>{const ranges=splitDjenCalendarMonths({start:'2026-01-15',end:'2026-04-10'});assert.deepEqual(ranges,[{start:'2026-01-15',end:'2026-01-31'},{start:'2026-02-01',end:'2026-02-28'},{start:'2026-03-01',end:'2026-03-31'},{start:'2026-04-01',end:'2026-04-10'}]);});
test('a consulta executa todos os meses mas o DataJud apenas uma vez',async()=>{
 const {consultHistoricalCase}=await import('../lib/judicial-history-client.mjs');
 const requests=[];
 const result=await consultHistoricalCase({number:'1001218-36.2026.5.02.0040',start:'2026-01-01',end:'2026-03-02',source:'auto',
  fetchServer:async args=>{requests.push(args);return {ok:true,items:[{id:args.start,source:args.source==='auto'?'DataJud':'DJEN',date:args.start}],sourceStatus:args.source==='auto'?{djen:'ok',datajud:'ok'}:{djen:'ok'}}}});
 assert.deepEqual(requests.map(x=>x.source),['auto','djen','djen']);
 assert.deepEqual(requests.map(x=>x.start),['2026-01-01','2026-02-01','2026-03-01']);
 assert.equal(result.partial,false);assert.equal(result.windowsChecked,3);assert.equal(result.items.length,3);
});
test('cache anterior DJEN é atualizado por consulta pública sem apagar DataJud',async()=>{
 const {consultHistoricalCase}=await import('../lib/judicial-history-client.mjs');
 let browsed=0;
 const result=await consultHistoricalCase({number:'1001218-36.2026.5.02.0040',start:'2026-10-01',end:'2026-10-15',source:'auto',
  fetchServer:async()=>({ok:true,fromCache:true,items:[{source:'DataJud',id:'original',date:'2026-10-11'}],sourceStatus:{djen:'cached_previous',datajud:'ok'}}),
  fetchBrowser:async()=>{browsed++;return {ok:true,items:[{source:'DJEN',id:'new',date:'2026-10-13'}]}}});
 assert.equal(browsed,1);assert.equal(result.sourceStatus.djen,'ok_browser');
 assert.equal(result.partial,false);assert.ok(result.items.find(x=>x.id==='original'));assert.ok(result.items.find(x=>x.id==='new'));
});
test('bloqueio 403 da fonte mantém histórico mas interrompe tentativas repetidas',async()=>{
 const {consultHistoricalCase}=await import('../lib/judicial-history-client.mjs');
 let serverCalls=0,browserCalls=0;
 const result=await consultHistoricalCase({number:'1001218-36.2026.5.02.0040',start:'2026-01-01',end:'2026-08-01',source:'auto',
  fetchServer:async()=>{serverCalls++;return {ok:false,fromCache:true,items:[{source:'DJEN',id:'cached',date:'2026-01-02'}],sourceStatus:{djen:'blocked_403',datajud:'blocked_403'},error:'Fonte HTTP 403'}},
  fetchBrowser:async()=>{browserCalls++;throw Error('DJEN respondeu 403')}});
 assert.equal(serverCalls,1);assert.equal(browserCalls,0);
 assert.ok(result.items.some(x=>x.id==='cached'));assert.equal(result.partial,true);assert.ok(result.windowsPending>0);assert.notEqual(result.sourceStatus.djen,'ok');
});
test('nunca usa navegador alternativo para escapar bloqueio 429',async()=>{
 const {consultHistoricalCase}=await import('../lib/judicial-history-client.mjs');
 let browserCalls=0;
 const result=await consultHistoricalCase({number:'1001218-36.2026.5.02.0040',start:'2026-01-01',end:'2026-01-31',source:'auto',
  fetchServer:async()=>({ok:false,error:'Fonte HTTP 429',sourceStatus:{djen:'rate_limited_429',datajud:'rate_limited_429'}}),
  fetchBrowser:async()=>{browserCalls++;throw Error('unexpected')}});
 assert.equal(browserCalls,0);assert.equal(result.partial,true);assert.equal(result.ok,false);
});

test('DJEN não pula páginas de um mês nem reutiliza o número de página no mês seguinte',async()=>{
 const {consultHistoricalCase}=await import('../lib/judicial-history-client.mjs');
 const requests=[];
 const fetchServer=async args=>{requests.push([args.start,args.page]);return {ok:true,items:[{id:args.start+args.page,source:'DJEN',date:args.start}],limited:args.start==='2026-01-01'&&args.page===1}};
 const a=await consultHistoricalCase({number:'1001218-36.2026.5.02.0040',start:'2026-01-01',end:'2026-02-28',source:'djen',fetchServer});
 assert.deepEqual(requests,[['2026-01-01',1]]);
 assert.deepEqual(a.nextPage,{start:'2026-01-01',end:'2026-02-28',page:2});
 assert.equal(a.partial,true);
 assert.equal(a.windowsChecked,0);
 const b=await consultHistoricalCase({number:'1001218-36.2026.5.02.0040',...a.nextPage,source:'djen',fetchServer});
 assert.deepEqual(requests,[['2026-01-01',1],['2026-01-01',2],['2026-02-01',1]]);
 assert.equal(b.partial,false);
});
test('continuação preserva resultados DataJud e DJEN anteriores sem duplicação',async()=>{
 const {mergeHistoricalContinuation}=await import('../lib/judicial-history-client.mjs');
 const a={items:[{id:'1',source:'DataJud',date:'2026-01-01'},{id:'2',source:'DJEN',date:'2026-01-02'}],sourceStatus:{datajud:'ok',djen:'ok'},sourceErrors:{datajud:null},ok:true};
 const b={items:[a.items[1],{id:'3',source:'DJEN',date:'2026-01-03'}],sourceStatus:{datajud:'not_checked',djen:'ok'},sourceErrors:{},ok:true};
 const c=mergeHistoricalContinuation(a,b);
 assert.equal(c.items.length,3);assert.equal(c.sourceStatus.datajud,'ok');assert.equal(c.found,true);
});
