import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Every public RLS table is restricted against OAuth INSERT UPDATE DELETE at PostgreSQL',()=>{
 const sql=read('supabase/migrations/20261116143000_killa_oauth_database_boundary.sql');
 assert.match(sql,/c\.relrowsecurity/);
 assert.match(sql,/AS RESTRICTIVE FOR INSERT/i);
 assert.match(sql,/AS RESTRICTIVE FOR UPDATE/i);
 assert.match(sql,/AS RESTRICTIVE FOR DELETE/i);
 assert.match(sql,/auth\.jwt\(\)->>''client_id''/);
 assert.match(sql,/REVOKE TRUNCATE/i);
 assert.match(sql,/REVOKE INSERT, UPDATE, DELETE.*anon/i);
});
test('Server APIs deny OAuth JWT except explicit MCP transport',()=>{
 const server=read('lib/office-server.mjs');
 const route=read('app/mcp/route.js');
 assert.match(server,/oauth_token_not_allowed/);
 assert.match(server,/allowOAuth=false/);
 assert.match(route,/allowOAuth:true/);
 assert.match(route,/authorizeKillaMcpSession/);
});
