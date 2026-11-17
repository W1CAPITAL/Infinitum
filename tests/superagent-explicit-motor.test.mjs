import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const text=readFileSync(new URL('../app/api/superagente/route.js',import.meta.url),'utf8');
test('explicit Colibri selection never silently forwards sensitive prompts to another model',()=>{
 assert.match(text,/preferredMotor!=='auto'\s*&&\s*preferredMotor!=='predictlm'/);
 assert.match(text,/!cascaded\.some\(m=>m\.id===preferredMotor\)/);
 assert.match(text,/allowFallback:preferredMotor==='auto'/);
});
