import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import config from '../next.config.mjs';

// Exercise the actual page function with a redirect stub, without a Next server.
const source=readFileSync(new URL('../app/prazos/page.jsx',import.meta.url),'utf8');
const page=new Function('redirect',source.replace("import {redirect} from 'next/navigation';",'').replace('export default async function Page','return async function Page'))(url=>{throw new Error(url)});
async function destination(params){try{await page({searchParams:Promise.resolve(params)})}catch(e){return e.message}throw new Error('Expected a redirect')}

test('return filters resolve directly to the tasks page without a reverse redirect',async()=>{
 const redirects=await config.redirects();
 for(const status of ['vencido','vencidos','hoje','proximos','atendimentos_hoje','meus_atendimentos','atendido','retornos']){
  const target=await destination({tipo:'retorno',status});
  assert.equal(target,`/tarefas?tipo=retorno&status=${status}`);
  assert.equal(redirects.some(r=>r.source==='/tarefas'),false,'The task page must not redirect back to deadlines');
 }
});
test('ordinary deadlines still resolve to the agenda',async()=>{
 assert.equal(await destination({}),'/agenda?tipo=prazo');
 assert.equal((await config.redirects()).some(r=>r.source==='/agenda'),false);
});
