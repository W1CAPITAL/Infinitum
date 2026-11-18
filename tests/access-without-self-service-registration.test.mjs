import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('login does not expose or call public account creation',()=>{
 const screen=read('components/secured-workspace.jsx');
 const layout=read('components/professional-auth.jsx');
 assert.doesNotMatch(screen,/auth\\.signUp\\(/);
 assert.doesNotMatch(screen,/mode==='signup'|setModeTo\\('signup'\\)|registration\\?signup:login/);
 assert.doesNotMatch(screen,/Criar conta|Cadastre-se|Entrar ou cadastrar/);
 assert.doesNotMatch(layout,/onSignup|signupMode|Criar conta/);
 assert.match(screen,/onSubmit=\\{login\\}/);
});

test('existing member authentication and recovery remain available',()=>{
 const screen=read('components/secured-workspace.jsx');
 assert.match(screen,/auth\\.signInWithPassword/);
 assert.match(screen,/auth\\.signInWithOtp/);
 assert.match(screen,/shouldCreateUser:false/);
 assert.match(screen,/auth\\.resetPasswordForEmail/);
 assert.match(screen,/auth\\.updateUser/);
 assert.match(screen,/!access\\.allowed/);
});
