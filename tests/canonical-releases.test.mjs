import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LATEST_SIGNED_MANIFEST,releaseArtifactUrl,validateReleaseMetadata} from '../desktop/release-trust.mjs';
import {validatedPublicOrigin} from '../desktop/public-origin.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('only the canonical W1 Capital GitHub repository can distribute installers',()=>{
 assert.equal(LATEST_SIGNED_MANIFEST,
  'https://github.com/W1CAPITAL/Infinitum/releases/latest/download/killa-update.json');
 const url=releaseArtifactUrl('1.2.3');
 assert.match(url,/github\.com\/W1CAPITAL\/Infinitum\/releases\/download\/v1\.2\.3/);
 const meta={schema:1,channel:'stable',appId:'br.com.w1capital.infinitum.killa',version:'1.2.3',tag:'v1.2.3',
  asset:{name:'INFINITUM-KillaAI-Setup-1.2.3-x64.exe',url,size:1000000,sha512:Buffer.alloc(64).toString('base64')}};
 assert.equal(validateReleaseMetadata(meta,'1.0.0').version,'1.2.3');
 assert.throws(()=>validateReleaseMetadata({...meta,asset:{...meta.asset,url:url.replace('W1CAPITAL/Infinitum','ProjectW1SC/INFINITUM')}},'1.0.0'),
  /Origem GitHub/);
});

test('desktop and Next share the same HTTPS origin validator and Electron packs it',()=>{
 const pkg=JSON.parse(read('desktop/package.json'));
 assert.ok(pkg.build.files.includes('public-origin.mjs'));
 assert.match(read('desktop/runtime-policy.mjs'),/\.\/public-origin\.mjs/);
 assert.match(read('lib/openbot-public-origin.mjs'),/\.\.\/desktop\/public-origin\.mjs/);
 assert.equal(validatedPublicOrigin('https://infinitum.example.test'), 'https://infinitum.example.test');
 assert.equal(validatedPublicOrigin('https://agentinfinitum.vercel.app'),null);
 assert.equal(validatedPublicOrigin('http://localhost:3000'),null);
 assert.equal(validatedPublicOrigin('https://admin:password@infinitum.example.test'),null);
});
