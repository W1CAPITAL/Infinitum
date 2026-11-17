import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,appendFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
 fetchTrustedResponse,downloadVerifiedInstaller,verifyLocalInstaller
} from '../desktop/free-update-client.mjs';
import {trustedHttpsUrl,LATEST_SIGNED_MANIFEST} from '../desktop/release-trust.mjs';

test('only official GitHub release infrastructure can serve an installer, even after redirect',async()=>{
 assert.equal(trustedHttpsUrl('https://github.com/ProjectW1SC/INFINITUM/releases/latest'),true);
 assert.equal(trustedHttpsUrl('https://github.com.evil.invalid/releases'),false);
 assert.equal(trustedHttpsUrl('http://github.com/releases'),false);
 assert.equal(trustedHttpsUrl('https://localhost/releases'),false);
 const fakeRedirect=async()=>new Response(null,{
  status:302,headers:{location:'https://evil.invalid/INFINITUM-KillaAI-Setup-2.0.0-x64.exe'}
 });
 await assert.rejects(fetchTrustedResponse(LATEST_SIGNED_MANIFEST,fakeRedirect),/origens oficiais/i);
});
test('a signed-metadata download is streamed, rechecked at install time and tampering fails closed',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'w1-killa-verified-'));
 try{
  const contents=Buffer.alloc(1000000,0x61);
  const hash=createHash('sha512').update(contents).digest('base64');
  const manifest={asset:{
   name:'INFINITUM-KillaAI-Setup-1.2.3-x64.exe',
   url:'https://github.com/ProjectW1SC/INFINITUM/releases/download/v1.2.3/INFINITUM-KillaAI-Setup-1.2.3-x64.exe',
   size:contents.length,sha512:hash
  }};
  const app={getPath:name=>{assert.equal(name,'userData');return dir}};
  const fetchImpl=async()=>new Response(contents,{status:200});
  const stages=[];
  const file=await downloadVerifiedInstaller({app,manifest,fetchImpl,onProgress:n=>stages.push(n)});
  assert.equal((await readFile(file)).length,contents.length);
  assert.equal(await verifyLocalInstaller(file,manifest),true);
  assert.equal(stages.at(-1),100);
  await appendFile(file,Buffer.from('INJECTED'));
  await assert.rejects(verifyLocalInstaller(file,manifest),/modificado|integridade/i);
  const invalid={asset:{...manifest.asset,sha512:Buffer.alloc(64,0).toString('base64')}};
  await assert.rejects(downloadVerifiedInstaller({app,manifest:invalid,fetchImpl}),/SHA-512|integridade|hash/i);
 }finally{await rm(dir,{recursive:true,force:true})}
});
