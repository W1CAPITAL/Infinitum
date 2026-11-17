import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Realtime publication is owner-scoped and excludes unfiltered global tables and DELETE',()=>{
 const sql=read('supabase/migrations/20261116170000_killa_desktop_owner_realtime.sql');
 for(const name of ['office_wa_chat_archive','office_wa_message_archive','killa_mcp_send_intents'])
  assert.ok(sql.includes(name));
 assert.doesNotMatch(sql,/office_agent_runs|crm_memberships|crm_activities/);
 assert.match(sql,/publish='insert,update'/);
 const r=read('lib/killa-realtime.mjs');
 assert.match(r,/owner_id=eq/);
 assert.match(r,/payload.eventType!=='INSERT'/);
});
test('the Edge desktop config never exports service keys and MCP still requires OAuth',()=>{
 const e=read('supabase/functions/killa-mcp/index.ts');
 assert.match(e,/desktop-config/);
 assert.match(e,/SUPABASE_ANON_KEY/);
 assert.match(e,/withOAuthProtectedResource/);
 const block=e.slice(e.indexOf("if(path.endsWith('/desktop-config'))"),e.indexOf("if(path.endsWith('/approve'))"));
 assert.doesNotMatch(block.replace(/\/\/[^\n]*/g,''),/SUPABASE_SERVICE_ROLE_KEY|sb_secret_|service_role/i);
});
