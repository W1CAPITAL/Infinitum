import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('registro Lexis reserva uma chave idempotente antes de atualizar o processo',()=>{
 const sql=read('supabase/lexis-primary/20261118_infinitum_attendance_idempotency.sql');
 assert.match(sql,/add column if not exists attendance_request_id uuid/i);
 assert.match(sql,/unique[\s\S]*empresa_id[\s\S]*responsavel_auth_user_id[\s\S]*attendance_request_id/i);
 assert.match(sql,/p_idempotency_key uuid/i);
 assert.match(sql,/on conflict \(empresa_id,responsavel_auth_user_id,attendance_request_id\)/i);
 assert.match(sql,/if v_evento is null[\s\S]*'idempotent',true/i);
 assert.ok(sql.indexOf('insert into public.tarefas_realizadas')<sql.indexOf('update public.processos'));
});

test('formulário mantém a mesma chave em retry e envia a chave ao RPC',()=>{
 const office=read('components/lexis-shared-office.jsx');
 assert.match(office,/attendanceRequest=useRef/);
 assert.match(office,/crypto\.randomUUID\(\)/);
 assert.match(office,/p_idempotency_key:attendanceRequest\.current/);
 assert.match(office,/attendanceRequest\.current=''[\s\S]*setSelected\(null\)/);
});
