import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Windows standalone build compiles the shared Lexis wallet configuration into the client bundle',()=>{
 const workflow=read('.github/workflows/killa-desktop-windows.yml').replace(/\r\n/g,'\n');
 const build=workflow.match(/- name: Build completo standalone sem Vercel\n([\s\S]*?)(?=\n      - name:|$)/)?.[1]||'';
 assert.match(build,/NEXT_PUBLIC_LEXIS_SHARED_DB:\s*['"]?1/);
 assert.match(build,/NEXT_PUBLIC_SUPABASE_URL:\s*['"]https:\/\/segjskjlbeydlljnefai\.supabase\.co['"]/);
 assert.match(build,/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:\s*['"]sb_publishable_[^'"]+['"]/);
 assert.doesNotMatch(build,/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
});

test('packaged Windows smoke test uses the same shared legal wallet project and mode',()=>{
 const smoke=read('desktop/verify-packaged-server.mjs');
 assert.match(smoke,/NEXT_PUBLIC_LEXIS_SHARED_DB:'1'/);
 assert.match(smoke,/NEXT_PUBLIC_SUPABASE_URL:'https:\/\/segjskjlbeydlljnefai\.supabase\.co'/);
 assert.match(smoke,/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_/);
});
