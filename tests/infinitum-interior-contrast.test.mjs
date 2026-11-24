import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {contrastRatio} from '../lib/crm-themes.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const css=read('app/infinitum-interiors.css');
function tokens(mode){const marker=mode==='dark'?'[data-crm-mode="dark"]':'[data-crm-mode]';const block=css.split(marker+' .inf-studio-chrome .inf-studio-frame{')[1].split('}')[0];return Object.fromEntries([...block.matchAll(/(--desk-[a-z-]+):\s*(#[0-9a-f]{6})\b/gi)].map(x=>[x[1],x[2]]))}
test('all interior foreground/background pairs meet 4.5:1 in both modes',()=>{
 for(const mode of ['light','dark']){
  const t=tokens(mode);
  for(const fg of ['ink','muted','brand','blue','teal','danger'])for(const bg of ['paper','bg','tint']){
   assert.ok(t['--desk-'+fg]&&t['--desk-'+bg],mode+' missing '+fg+'/'+bg);
   assert.ok(contrastRatio(t['--desk-'+fg],t['--desk-'+bg])>=4.5,mode+' '+fg+'/'+bg);
  }
  for(const fg of ['hero-ink','hero-muted'])assert.ok(contrastRatio(t['--desk-'+fg],t['--desk-hero-surface'])>=4.5,mode+' '+fg);
 }
});
test('legacy blanket panel rules do not compete with the dashboard hero; colors stay paired',()=>{
 const signature=read('app/infinitum-signature.css');
 assert.doesNotMatch(signature,/\.office-ai-rail,\.wa-conversation-list,\.inf-document-step,\.ixr-panel,\.inf-priority-board/);
 assert.match(css,/\.inf-home-focus \.inf-priority-board\{[^}]*background:var\(--desk-hero\)!important/s);
 assert.match(css,/\.inf-priority-actions a\{[^}]*background:var\(--desk-hero-surface\)!important[^}]*color:var\(--desk-hero-ink\)!important/s);
 assert.match(css,/\.inf-priority-actions :is\(strong,b\)\{color:var\(--desk-hero-ink\)!important/);
 assert.match(css,/\.inf-priority-actions small\{color:var\(--desk-hero-muted\)!important/);
 assert.match(css,/::placeholder/);assert.match(css,/\.lx-status--vencido/);
 assert.doesNotMatch(css,/\.app-sidebar|\.inf-category-rail/);
});
