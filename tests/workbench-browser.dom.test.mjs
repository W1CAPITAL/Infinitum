import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync,readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const {transformSync}=require('next/dist/build/swc');
for(const ext of ['.jsx','.tsx'])require.extensions[ext]=(mod,filename)=>{
 const {code}=transformSync(readFileSync(filename,'utf8'),{filename,jsc:{parser:{syntax:ext==='.tsx'?'typescript':'ecmascript',tsx:ext==='.tsx',jsx:true},transform:{react:{runtime:'automatic'}},target:'es2022'},module:{type:'commonjs'}});
 mod._compile(code,filename);
};
require.extensions['.css']=()=>{};
const OfficeDocumentWorkspace=require('../components/office-document-workspace.jsx').default;
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Chromium computes the actual document workspace with all global CSS in Light and Dark',t=>{
 const chrome=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(x=>x&&existsSync(x));
 if(!chrome){t.skip('Chromium unavailable');return}
 const dir=mkdtempSync(join(tmpdir(),'infinitum-visual-'));
 try{
  const css=[...read('app/layout.jsx').matchAll(/import '\.\/([^']+\.css)'/g)].map(m=>read('app/'+m[1])).join('\n');
  const markup=renderToStaticMarkup(React.createElement(OfficeDocumentWorkspace,{cases:[{id:'fixture',title:'Cliente fictício',process_number:'CNJ de teste'}],selectedCase:'fixture',docKind:'manifestacao',docSourceDocument:'',docInstructions:'',documents:[],docResult:null}));
  for(const mode of ['light','dark']){
   const path=join(dir,mode+'.html');
   const verify=String.raw`const q=s=>document.querySelector(s), rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),lum=s=>rgb(s).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0),ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
   const paper=q('.workbench-paper'),strong=q('.workbench-paper-meta strong'),body=getComputedStyle(paper),fg=getComputedStyle(strong);
   document.body.dataset.result=JSON.stringify({paperContrast:ratio(fg.color,body.backgroundColor),paperBg:body.backgroundColor,hiddenSteps:[...document.querySelectorAll('fieldset[hidden]')].every(x=>getComputedStyle(x).display==='none'),visibleSteps:[...document.querySelectorAll('fieldset:not([hidden])')].filter(x=>getComputedStyle(x).display!=='none').length,paperWidth:paper.getBoundingClientRect().width});`;
   writeFileSync(path,'<!doctype html><html data-crm-theme="infinitum" data-crm-mode="'+mode+'"><head><meta charset="utf-8"><style>'+css+'</style></head><body><div class="app-shell blackhole-studio-shell inf-workspace-v2 inf-signature-shell inf-studio-chrome sidebar-collapsed"><div class="app-content" data-route="/pecas"><div class="inf-studio-frame"><main class="inf-studio">'+markup+'</main></div></div></div><script>'+verify+'</script></body></html>');
   const output=execFileSync(chrome,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-background-networking','--window-size=1440,1000','--dump-dom',pathToFileURL(path).href],{encoding:'utf8',timeout:30000,maxBuffer:15*1024*1024,stdio:['ignore','pipe','ignore']});
   const raw=output.match(/data-result="([^"]+)"/)?.[1];assert.ok(raw,'Chromium executed visual checks: '+mode);
   const result=JSON.parse(raw.replaceAll('&quot;','"'));
   assert.ok(result.paperContrast>=4.5,JSON.stringify(result));assert.equal(result.hiddenSteps,true);assert.equal(result.visibleSteps,1);assert.ok(result.paperWidth>220);
  }
 }finally{rmSync(dir,{recursive:true,force:true})}
});
