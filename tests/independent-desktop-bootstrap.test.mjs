import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('desktop reads public Supabase configuration from the project hosting the shared Lexis wallet',()=>{
 const main=read('desktop/main.mjs');
 const edge=read('supabase/functions/infinitum-desktop-config/index.ts');
 assert.match(main,/segjskjlbeydlljnefai\.supabase\.co\/functions\/v1\/infinitum-desktop-config/);
 assert.match(edge,/SUPABASE_ANON_KEY/);
 assert.match(edge,/SUPABASE_PROJECT='https:\/\/segjskjlbeydlljnefai\.supabase\.co'/);
 assert.match(edge,/INFINITUM_CANONICAL_ORIGIN/);
 assert.match(edge,/Access-Control-Allow-Origin/);
 assert.doesNotMatch(edge,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
 assert.doesNotMatch(main,/killa-mcp\/desktop-config|agentinfinitum\.vercel\.app/);
});
