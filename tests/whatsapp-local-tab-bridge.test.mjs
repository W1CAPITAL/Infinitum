import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateBridgeRequest,canUseGrantedTab,sanitizeWhatsappSnapshot,BRIDGE_ORIGIN} from '../browser-extension/infinitum-tab-bridge/policy.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('only permanent INFINITUM origin can ask extension to inspect existing WhatsApp Web tab',()=>{
 assert.equal(BRIDGE_ORIGIN,'https://agentinfinitum.vercel.app');
 assert.equal(validateBridgeRequest({type:'observe'},BRIDGE_ORIGIN).ok,true);
 assert.equal(validateBridgeRequest({type:'observe'},'https://evil.example').ok,false);
 assert.equal(validateBridgeRequest({type:'observe'},'https://projectw1sc-temp.vercel.app').ok,false);
 assert.equal(validateBridgeRequest({type:'send'},BRIDGE_ORIGIN).ok,false);
 assert.equal(validateBridgeRequest({type:'navigate'},BRIDGE_ORIGIN).ok,false);
 assert.equal(validateBridgeRequest({type:'getCookies'},BRIDGE_ORIGIN).ok,false);
 assert.equal(validateBridgeRequest({type:'draft',text:'  Olá, tudo bem?  ',expectedTitle:'Cliente'} ,BRIDGE_ORIGIN).ok,true);
 assert.equal(validateBridgeRequest({type:'draft',text:'  Olá, tudo bem?  '},BRIDGE_ORIGIN).ok,false);
 assert.equal(validateBridgeRequest({type:'draft',text:'x'.repeat(3500)},BRIDGE_ORIGIN).ok,false);
});
test('WhatsApp tab must be explicitly granted, on web.whatsapp.com and grant has not expired',()=>{
 const now=1763276400000;
 const grant={tabId:123,expiresAt:now+15*60000};
 assert.equal(canUseGrantedTab(grant,{id:123,url:'https://web.whatsapp.com/'},now),true);
 assert.equal(canUseGrantedTab(grant,{id:125,url:'https://web.whatsapp.com/'},now),false);
 assert.equal(canUseGrantedTab(grant,{id:123,url:'https://web.whatsapp.com.evil.com/'},now),false);
 assert.equal(canUseGrantedTab(grant,{id:123,url:'https://web.whatsapp.com/'},now+20*60000),false);
 assert.equal(canUseGrantedTab(null,{id:123,url:'https://web.whatsapp.com/'},now),false);
});
test('observation includes current chat only, small bounded history and no sensitive browser state',()=>{
 const text='x'.repeat(4000);
 const data={title:'Cliente autorizado',messages:Array.from({length:90},(_,i)=>({text:text+String(i),direction:i%2?'out':'in'})),
   cookies:'never',token:'never',localStorage:{secret:'never'},jid:'unverified'};
 const safe=sanitizeWhatsappSnapshot(data);
 assert.equal(safe.messages.length,8);
 assert.ok(safe.messages.every(m=>m.text.length<=260));
 assert.equal(safe.title,'Cliente autorizado');
 assert.equal('cookies' in safe,false);
 assert.equal('token' in safe,false);
 assert.equal('jid' in safe,false);
 assert.equal(safe.identityVerified,false);
});
test('browser extension has least-privilege manifest and no arbitrary browsing permissions',()=>{
 const manifest=JSON.parse(read('browser-extension/infinitum-tab-bridge/manifest.json'));
 assert.equal(manifest.manifest_version,3);
 assert.deepEqual(manifest.host_permissions.sort(),
  ['https://agentinfinitum.vercel.app/*','https://web.whatsapp.com/*'].sort());
 assert.ok(!manifest.permissions.includes('cookies'));
 assert.ok(!manifest.permissions.includes('debugger'));
 assert.ok(!manifest.permissions.includes('webRequest'));
 assert.ok(!manifest.host_permissions.some(s=>s.includes('<all_urls>')));
 assert.equal(manifest.action.default_popup,'popup.html');
});
test('authorizing an open WhatsApp tab makes the bridge visible to an already-open CRM tab',()=>{
 const background=read('browser-extension/infinitum-tab-bridge/background.js');
 const bridge=read('browser-extension/infinitum-tab-bridge/crm-bridge.js');
 assert.match(background,/announceGrantToExistingCrmTabs/);
 assert.match(background,/files:\['crm-bridge\.js'\]/);
 assert.match(background,/agentinfinitum\.vercel\.app/);
 assert.match(bridge,/__infinitumWhatsappBridgeReady/);
 assert.match(bridge,/direction:'ready'/);
});
test('no autonomous send: extension can only observe chat and insert a reviewable composer draft',()=>{
 const background=read('browser-extension/infinitum-tab-bridge/background.js');
 const inspector=read('browser-extension/infinitum-tab-bridge/whatsapp-tab.js');
 const panel=read('components/whatsapp-tab-bridge-panel.jsx');
 const inbox=read('components/wa-auto-inbox.jsx');
 assert.match(background,/chrome\.storage\.session/);
 assert.match(background,/chrome\.scripting\.executeScript/);
 assert.match(background,/canUseGrantedTab/);
 assert.match(inspector,/contenteditable/);
 assert.doesNotMatch(inspector,/click\(\).*send|button\[.*send.*\]\.click/);
 assert.doesNotMatch(background,/sendMessageToContact|bulkSend|waAutoOperation\('send'/);
 assert.match(panel,/INFINITUM_BROWSER_TAB_BRIDGE/);
 assert.match(panel,/Preparar no WhatsApp Web/);
 assert.match(inbox,/WhatsappTabBridgePanel/);
});
