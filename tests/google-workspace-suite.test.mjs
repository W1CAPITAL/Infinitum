import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OPENBOT_CONNECTORS,GOOGLE_OAUTH_SCOPES,authorizationUrl} from '../lib/openbot-connectors.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Google Workspace catalog exposes Drive, Sheets, Gmail, Calendar, Meet, Chat and YouTube as OAuth services',()=>{
 const ids=['drive','sheets','gmail','calendar','meet','chat','youtube'];
 for(const id of ids){
  const c=OPENBOT_CONNECTORS.find(x=>x.id===id);
  assert.ok(c,'missing '+id);
  assert.equal(c.provider,'google');
  assert.equal(c.mode,'oauth');
  assert.equal(c.category,'Google Workspace');
 }
});
test('Google OAuth requests only the read-only scopes for the selected service',()=>{
 const services={
  drive:['drive.metadata.readonly'],
  sheets:['drive.metadata.readonly','spreadsheets.readonly'],
  gmail:['gmail.readonly'],
  calendar:['calendar.events.readonly'],
  meet:['meetings.space.readonly'],
  chat:['chat.spaces.readonly','chat.messages.readonly'],
  youtube:['youtube.readonly']
 };
 for(const [connectorId,scopes] of Object.entries(services)){
  const url=new URL(authorizationUrl('google',{
   clientId:'test.apps.googleusercontent.com',
   redirectUri:'https://agentinfinitum.vercel.app/api/openbot/integrations/oauth/callback',
   state:'sealed',challenge:'pkce',connectorId
  }));
  assert.equal(url.hostname,'accounts.google.com');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  const requested=url.searchParams.get('scope');
  for(const scope of scopes)assert.ok(requested.includes(scope),'missing '+connectorId+' scope '+scope);
  assert.match(requested,/openid/);
  assert.doesNotMatch(requested,/gmail\.send|drive\.file|spreadsheets\.write|calendar\.events(?:\s|$)|chat\.messages(?:\s|$)|youtube\.upload/);
  const unrelated=Object.entries(services).filter(([id])=>id!==connectorId).flatMap(([,list])=>list)
   .filter(scope=>!scopes.includes(scope));
  for(const scope of unrelated)assert.ok(!requested.includes(scope),'overbroad scope '+scope+' for '+connectorId);
 }
});
test('Google service reader exposes real read-only Gmail messages, Calendar events, Meet spaces, Chat spaces/messages and YouTube uploads',()=>{
 const route=read('app/api/openbot/integrations/data/route.js');
 for(const service of ['calendar','meet','chat','chat_messages','youtube'])
  assert.ok(route.includes("service==='"+service+"'"),'missing service '+service);
 assert.match(route,/gmail\.googleapis\.com\/gmail\/v1\/users\/me\/messages/);
 assert.ok(route.includes('https://www.googleapis.com/calendar/v3/calendars/primary/events'));
 assert.match(route,/meet\.googleapis\.com\/v2\/spaces/);
 assert.match(route,/chat\.googleapis\.com\/v1\/spaces/);
 assert.match(route,/youtube\/v3\/channels/);
 assert.match(route,/youtube\/v3\/playlistItems/);
 assert.match(route,/space_id/);
 assert.match(route,/format:'metadata'/);
 assert.doesNotMatch(route,/gmail\.send|messages\.send|videos\.insert|events\.insert/);
});
test('Connected-app interface lets the user open Google Chat messages after listing spaces',()=>{
 const ui=read('components/openbot-connected-apps.jsx');
 assert.match(ui,/previewChatMessages/);
 assert.match(ui,/Ler mensagens/);
 assert.match(ui,/SERVICE_LABELS/);
});
