import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('store security is private, MFA required and release approval is independent of MCP',()=>{
 const sql=file('supabase/migrations/20261116_killa_store_superadmin.sql');
 assert.match(sql,/CREATE SCHEMA IF NOT EXISTS killa_private/i);
 assert.match(sql,/REVOKE ALL ON SCHEMA killa_private FROM PUBLIC, anon, authenticated/i);
 assert.match(sql,/killa_store_superadmins/);
 assert.match(sql,/killa_store_release_requests/);
 assert.match(sql,/killa_store_audit/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/i);
 const edge=file('supabase/functions/killa-store-admin/index.ts');
 assert.match(edge,/auth\.getUser/);
 assert.match(edge,/aal2/);
 assert.match(edge,/killa_store_admin_access/); // private schema is accessed only through service-only RPC
 assert.match(edge,/superadmin/i);
 assert.match(edge,/github/);
 assert.doesNotMatch(edge,/allowedOrigin:\s*'\*'/i);
 const ui=file('app/app-store/admin/page.jsx');
 assert.match(ui,/mfa\.enroll/);
 assert.match(ui,/mfa\.challengeAndVerify/);
 assert.match(ui,/typecheck/i);
 assert.match(ui,/build logs/i);
 assert.match(ui,/Env/);
 assert.doesNotMatch(ui,/service_role|sb_secret_/i);
});
test('external MCP may read redacted diagnostics and request but not bypass approval',()=>{
 const edge=file('supabase/functions/killa-store-admin/index.ts');
 for(const name of ['killa_store_status','killa_store_build_logs','killa_store_request_release','killa_store_request_status'])
  assert.match(edge,new RegExp(name));
 assert.match(edge,/client_id/);
 assert.match(edge,/allowed_client_ids/);
 assert.match(edge,/require_mfa/);
 assert.match(edge,/approval_required/);
 assert.doesNotMatch(edge,/registerTool\('killa_store_approve_release'/);
 const workflow=file('.github/workflows/killa-desktop-free-release.yml');
 assert.match(workflow,/environment:\s*desktop-production/);
 assert.match(workflow,/workflow_dispatch/);
 assert.match(workflow,/refs\/heads\/main/);
});
test('launcher has a superadmin-only diagnostic entry, not credentials or bypass',()=>{
 const launcher=file('desktop/launcher.html');
 assert.match(launcher,/admin.*diagnostic|diagnostic.*admin/i);
 const main=file('desktop/main.mjs');
 assert.match(main,/launcher:open-admin/);
 assert.match(main,/\/app-store\/admin/);
 assert.doesNotMatch(main,/KILLA_GITHUB_WRITE_TOKEN\s*:/);
});
