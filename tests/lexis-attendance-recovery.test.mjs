import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const company='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const user='11111111-1111-4111-8111-111111111111';
const key='33333333-3333-4333-8333-333333333333';
const folder=new URL('../supabase/lexis-primary/',import.meta.url);
async function database(){
 const db=new PGlite();
 await db.exec(`
  create role anon;create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function public.get_user_empresa_id() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.empresa_id',true),'')::uuid$$;
  create table public.usuarios(nome text,auth_user_id uuid,empresa_id uuid);
  create table public.processos(id bigint primary key,empresa_id uuid,protocolo_ref text,ultimo_retorno date,proximo_retorno date,atendido_por text,updated_at timestamptz);
  create table public.tarefas_realizadas(id uuid primary key default gen_random_uuid(),empresa_id uuid,responsavel_auth_user_id uuid,titulo text,descricao text,categoria text,data_realizacao date,protocolo_ref text,processo_id bigint,contato_cliente_confirmado boolean,origem text);
  insert into public.usuarios values('Operador de teste','${user}','${company}');
  insert into public.processos(id,empresa_id,ultimo_retorno,proximo_retorno) values(101,'${company}','2026-10-01','2030-01-10'),(202,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-10-01','2030-01-10');
  alter table public.processos enable row level security;
  alter table public.tarefas_realizadas enable row level security;
  create policy company_process on public.processos to authenticated using(empresa_id=public.get_user_empresa_id()) with check(empresa_id=public.get_user_empresa_id());
  create policy company_audit on public.tarefas_realizadas to authenticated using(empresa_id=public.get_user_empresa_id() and responsavel_auth_user_id=auth.uid()) with check(empresa_id=public.get_user_empresa_id() and responsavel_auth_user_id=auth.uid());
  grant usage on schema public,auth to authenticated;
  grant select on public.usuarios to authenticated;
  grant select,insert,update on public.processos to authenticated;
  grant select,insert on public.tarefas_realizadas to authenticated;
 `);
 await db.exec(readFileSync(new URL('20261118_infinitum_attendance_idempotency.sql',folder),'utf8'));
 for(const file of readdirSync(folder).filter(f=>f.includes('attendance_content_binding')&&f.endsWith('.sql')).sort())
  await db.exec(readFileSync(new URL(file,folder),'utf8'));
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);select set_config('request.jwt.claim.empresa_id','${company}',false);`);
 return db;
}
async function call(db,{process=101,note='Contato sintético confirmado',next='2030-01-20',confirmed=true,request=key}={}){
 return (await db.query('select public.infinitum_registrar_atendimento($1::bigint,$2::text,$3::date,$4::boolean,$5::uuid) as result',[process,note,next,confirmed,request])).rows[0].result;
}
test('Postgres rejeita reutilização da chave com conteúdo diferente e não perde a alteração silenciosamente',async()=>{
 const db=await database();
 try{
  const first=await call(db);assert.equal(first.ok,true);
  for(const patch of [{note:'Outro contato sintético'},{next:'2030-02-01'},{confirmed:false}])
   await assert.rejects(()=>call(db,patch),error=>error.code==='23505');
  assert.equal((await db.query('select count(*)::int as n from public.tarefas_realizadas')).rows[0].n,1);
  assert.equal((await call(db)).evento_id,first.evento_id);
 }finally{await db.close()}
});
test('recibo do retry conserva a data original após outro atendimento atualizar o processo',async()=>{
 const db=await database();
 try{
  const first=await call(db);
  await db.exec("update public.processos set ultimo_retorno='2030-03-01',proximo_retorno='2030-03-10' where id=101");
  const replay=await call(db);
  assert.equal(replay.idempotent,true);
  assert.equal(replay.ultimo_atendimento,first.ultimo_atendimento);
  assert.equal(replay.proximo_atendimento,first.proximo_atendimento);
  const second=await call(db,{request:'44444444-4444-4444-8444-444444444444',next:null});
  await db.exec("update public.processos set proximo_retorno='2030-04-10' where id=101");
  assert.equal((await call(db,{request:'44444444-4444-4444-8444-444444444444',next:null})).proximo_atendimento,second.proximo_atendimento);
 }finally{await db.close()}
});
test('função continua sujeita à RLS e rejeita ausência de identidade',async()=>{
 const db=await database();
 try{
  await assert.rejects(()=>call(db,{process:202}),error=>error.code==='42501');
  await db.exec("select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(()=>call(db),error=>error.code==='42501');
  await db.exec('set role anon');
  await assert.rejects(()=>call(db),error=>error.code==='42501');
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int as n from public.tarefas_realizadas')).rows[0].n,0);
 }finally{await db.close()}
});
test('evento legado sem snapshot não é convertido em confirmação inventada',async()=>{
 const db=await database();
 try{
  await db.query(`insert into public.tarefas_realizadas(empresa_id,responsavel_auth_user_id,processo_id,attendance_request_id,descricao) values($1,$2,101,$3,'Evento legado sintético')`,[company,user,key]);
  await assert.rejects(()=>call(db),error=>error.code==='23505');
 }finally{await db.close()}
});
