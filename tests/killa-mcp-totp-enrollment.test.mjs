import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('MCP setup provides user-controlled TOTP enrollment and QR display',()=>{
 const page=read('app/mcp/setup/page.jsx');
 assert.match(page,/auth\.mfa\.enroll\(/);
 assert.match(page,/totp\?\.qr_code/);
 assert.match(page,/INFINITUM Killa MCP/);
});

test('MCP setup verifies the six-digit TOTP challenge and checks AAL2 after verification',()=>{
 const page=read('app/mcp/setup/page.jsx');
 assert.match(page,/auth\.mfa\.challengeAndVerify\(/);
 assert.match(page,/getAuthenticatorAssuranceLevel\(/);
 assert.match(page,/currentLevel==='aal2'/);
 assert.match(page,/^.*mfaCode.*slice\(0,6\).*$/m);
});

test('MCP setup never displays or logs the raw TOTP secret',()=>{
 const page=read('app/mcp/setup/page.jsx');
 assert.match(page,/qr_code/);
 assert.doesNotMatch(page,/totp\?\.secret|console\.(log|info|debug).*secret/i);
});
