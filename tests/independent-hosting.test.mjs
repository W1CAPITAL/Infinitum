import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDesktopConfig,safeStandaloneEnvironment} from '../desktop/runtime-policy.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const config={supabaseUrl:'https://segjskjlbeydlljnefai.supabase.co',
 publishableKey:'sb_publishable_sample-not-a-real-token',
 bridgeOrigin:'https://lexispredict-wa-auto.onrender.com',
 remoteOrigin:'https://infinitum.example.test'};

test('desktop config accepts a canonical HTTPS app origin and rejects Vercel or unsafe origins',()=>{
 assert.equal(validateDesktopConfig(config).remoteOrigin,config.remoteOrigin);
 assert.throws(()=>validateDesktopConfig({...config,remoteOrigin:'https://agentinfinitum.vercel.app'}),/Vercel|domínio|origem/i);
 assert.throws(()=>validateDesktopConfig({...config,remoteOrigin:'http://infinitum.example.test'}),/HTTPS|origem/i);
 assert.throws(()=>validateDesktopConfig({...config,remoteOrigin:'https://infinitum.example.test:8443'}),/porta|origem/i);
});

test('desktop launcher, relay, OAuth and MCP metadata do not depend on Vercel',()=>{
 const main=read('desktop/main.mjs');
 const relay=read('app/api/openbot/relay/route.js');
 const oauth=read('lib/openbot-connection-server.mjs');
 const callback=read('app/api/openbot/integrations/oauth/callback/route.js');
 const mcp=read('app/api/openbot/mcp/route.js');
 const metadata=read('app/.well-known/oauth-protected-resource/api/openbot/mcp/route.js');
 assert.match(main,/functions\/v1\/killa-mcp\/desktop-config/);
 assert.doesNotMatch(main,/agentinfinitum\.vercel\.app/);
 assert.match(relay,/process\.env\.OPENBOT_DESKTOP_REMOTE/);
 assert.doesNotMatch(relay,/agentinfinitum\.vercel\.app/);
 assert.match(oauth,/NEXT_PUBLIC_SITE_URL/);
 assert.doesNotMatch(oauth,/agentinfinitum\.vercel\.app/);
 assert.match(callback,/NEXT_PUBLIC_SITE_URL/);
 assert.doesNotMatch(callback,/agentinfinitum\.vercel\.app/);
 assert.match(mcp,/NEXT_PUBLIC_SITE_URL/);
 assert.doesNotMatch(mcp,/agentinfinitum\.vercel\.app/);
 assert.match(metadata,/NEXT_PUBLIC_SITE_URL/);
 assert.doesNotMatch(metadata,/agentinfinitum\.vercel\.app/);
});

test('desktop child receives only the configured remote origin, never a provider default',()=>{
 const env=safeStandaloneEnvironment(config,54193,{});
 assert.equal(env.OPENBOT_DESKTOP_REMOTE,config.remoteOrigin);
 assert.equal(env.SUPABASE_SERVICE_ROLE_KEY,undefined);
});
