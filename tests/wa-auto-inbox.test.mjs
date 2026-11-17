import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('WhatsApp interno substitui a pagina Meta/WhatsApp Web',()=>{
 assert.match(file('app/whatsapp/page.jsx'),/WaAutoInbox/);
 const ui=file('components/wa-auto-inbox.jsx');
 for(const name of ['connect','pair','logout','chats','messages','send','Gerar código','Conectar por QR','CAIXA DE ENTRADA','Enviar'])assert.ok(ui.includes(name),'Falta: '+name);
 assert.doesNotMatch(ui,/graph\.facebook\.com|WhatsApp Business Cloud API/);
});
test('QR gerado no navegador por pacote local e token preservado no servidor',()=>{
 assert.match(file('components/wa-auto-inbox.jsx'),/import\('qrcode'\)/);
 assert.match(file('app/layout.jsx'),/wa-auto-inbox\.css/);
 assert.equal(JSON.parse(file('package.json')).dependencies.qrcode,'1.5.4');
});
test('Integracoes indicam o estado real do WA.Auto',()=>{
 const s=file('components/office-integrations.jsx');
 assert.match(s,/WA.Auto · WhatsApp interno/);
 assert.match(s,/wa\.connected/);
});

test('WA.Auto missing endpoint pauses repeated failing status requests but allows manual retry and ZapFast link',()=>{
 const ui=file('components/wa-auto-inbox.jsx');
 const pair=file('app/mcp/pair/page.jsx');
 assert.match(ui,/statusPollingEnabled\.current=body\.configured===true/);
 assert.match(ui,/statusPollingEnabled\.current=false/);
 assert.match(ui,/statusPollingEnabled\.current\)/);
 assert.match(ui,/wa_auto_upstream_route_missing/);
 assert.match(ui,/sua sessão ZapFast/);
 assert.match(pair,/statusPollingEnabled\.current/);
 assert.match(pair,/Reverificar servidor WA.Auto/);
});
test('QR pronto do Baileys não é recodificado como texto',()=>{const ui=file('components/wa-auto-inbox.jsx');assert.ok(ui.includes('data:image'));assert.ok(ui.includes('setQrImage(String(connection.qr))'));assert.match(ui,/4000/);});


test('WA.Auto offers the existing ZapFast session without silently making a second QR',()=>{
 const ui=file('components/wa-auto-inbox.jsx');
 assert.match(ui,/ZAPFAST_SINGLE_SESSION_URL/);
 assert.match(ui,/Mesmo número|mesmo número/);
 assert.match(ui,/target="_blank"/);
});
