import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isLexisCompanyAdmin} from '../lib/crm-access.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Lexis company Superadmin is recognized even when legacy role column says operador',()=>{
 assert.equal(isLexisCompanyAdmin({role:'operador',cargo:'Superadmin'}),true);
});

test('Lexis company Administrator cargo is recognized even when role column says operador',()=>{
 assert.equal(isLexisCompanyAdmin({role:'operador',cargo:'Administrador'}),true);
});

test('canonical admin role is recognized without relying on a display cargo',()=>{
 assert.equal(isLexisCompanyAdmin({role:'administrador',cargo:'Atendimento'}),true);
 assert.equal(isLexisCompanyAdmin({role:'admin',cargo:'Atendimento'}),true);
});

test('ordinary operators and lookalike titles do not receive company admin access',()=>{
 assert.equal(isLexisCompanyAdmin({role:'operador',cargo:'Operador'}),false);
 assert.equal(isLexisCompanyAdmin({role:'operador',cargo:'Assistente administrativo'}),false);
 assert.equal(isLexisCompanyAdmin({role:'operador',cargo:'Supervisora'}),false);
});

test('MCP company API reads the protected cargo field and uses the same admin decision for display and writes',()=>{
 const route=read('app/api/office/agent/company/route.js');
 assert.match(route,/select\('empresa_id,role,cargo,nome'\)/);
 assert.match(route,/isLexisCompanyAdmin\(member\)/);
 assert.doesNotMatch(route,/const isAdmin=r=>String\(r\?\?''\)\.toLowerCase\(\)==='administrador'/);
});
