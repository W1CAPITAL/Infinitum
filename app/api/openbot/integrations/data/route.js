import {officeAuth,officeJson,safeOfficeError} from '../../../../../lib/office-server.mjs';
import {adminClient,decryptToken,encryptToken,providerCredentials}
 from '../../../../../lib/openbot-connection-server.mjs';
import {getGoogleServiceScopes} from '../../../../../lib/openbot-connectors.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const SERVICES={drive:'google',sheets:'google',gmail:'google',calendar:'google',meet:'google',
 chat:'google',chat_messages:'google',youtube:'google',instagram:'meta'};
const MAX_OUTPUT=18000;
const timeout=()=>AbortSignal.timeout(12000);
async function readApi(url,access){
 const response=await fetch(url,{headers:{Authorization:'Bearer '+access,Accept:'application/json'},
  redirect:'error',signal:timeout(),cache:'no-store'});
 const source=await response.text();
 if(source.length>110000)throw Object.assign(Error('Resposta do provedor excedeu o limite.'),{status:502});
 let json;try{json=JSON.parse(source)}catch{throw Error('Provedor devolveu dados inválidos.')}
 if(!response.ok){
  const message=String(json.error?.message||json.error_description||'A conexão foi recusada.').slice(0,170);
  throw Object.assign(Error(message),{status:response.status===401?401:502});
 }
 return json;
}
async function googleRefresh(account,token,admin){
 const expiration=account.expires_at?Date.parse(account.expires_at):0;
 if(!expiration||Date.now()<expiration-60000)return token;
 if(!token.refresh_token)throw Object.assign(Error('Sessão Google expirada. Reconecte esta conta.'),{status:401});
 const creds=providerCredentials('google');
 const body=new URLSearchParams({client_id:creds.clientId,client_secret:creds.secret,
  refresh_token:token.refresh_token,grant_type:'refresh_token'});
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',
  headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString(),signal:timeout(),cache:'no-store'});
 const raw=await response.json().catch(()=>({}));
 if(!response.ok||!raw.access_token)throw Object.assign(Error('O Google exige nova autorização.'),{status:401});
 const updated={...token,...raw,refresh_token:token.refresh_token};
 const expiresAt=Number(raw.expires_in)>0?new Date(Date.now()+Number(raw.expires_in)*1000).toISOString():null;
 const save=await admin.from('openbot_connections').update({
  tokens_ciphertext:encryptToken(updated),expires_at:expiresAt,updated_at:new Date().toISOString()
 }).eq('id',account.id).eq('owner_id',account.owner_id);
 if(save.error)throw Error('Não foi possível salvar o token renovado.');
 return updated;
}
function header(headers,name){
 return (headers||[]).find(x=>String(x.name||'').toLowerCase()===name.toLowerCase())?.value||'';
}
async function readGmail(access){
 const [labels,list]=await Promise.all([
  readApi('https://gmail.googleapis.com/gmail/v1/users/me/labels',access),
  readApi('https://gmail.googleapis.com/gmail/v1/users/me/messages?'+new URLSearchParams({maxResults:'8',q:'in:inbox'}),access)
 ]);
 const messages=await Promise.all((list.messages||[]).slice(0,8).map(async item=>{
  const metadataQuery=new URLSearchParams({format:'metadata'});
  for(const name of ['From','Subject','Date'])metadataQuery.append('metadataHeaders',name);
  const detail=await readApi('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(item.id)+'?'+metadataQuery,access);
  const headers=detail.payload?.headers||[];
  return {id:detail.id,name:header(headers,'Subject')||'(sem assunto)',
   from:header(headers,'From'),date:header(headers,'Date'),snippet:String(detail.snippet||'').slice(0,360),
   url:'https://mail.google.com/mail/u/0/#all/'+encodeURIComponent(detail.id)};
 }));
 return {items:messages,summary:{inboxMessages:messages.length,
  labels:(labels.labels||[]).filter(x=>['INBOX','SENT','DRAFT','UNREAD'].includes(x.id)||x.type==='user').length}};
}
async function readCalendar(access){
 const now=new Date(),end=new Date(now.getTime()+30*86400000);
 const query=new URLSearchParams({maxResults:'15',orderBy:'startTime',singleEvents:'true',
  timeMin:now.toISOString(),timeMax:end.toISOString(),conferenceDataVersion:'1',
  fields:'items(id,summary,start,end,htmlLink,hangoutLink,conferenceData,organizer,status)'});
 const out=await readApi('https://www.googleapis.com/calendar/v3/calendars/primary/events?'+query,access);
 return {items:(out.items||[]).map(x=>({id:x.id,name:x.summary||'(sem título)',
  start:x.start?.dateTime||x.start?.date||'',end:x.end?.dateTime||x.end?.date||'',
  url:x.hangoutLink||x.htmlLink||'',meetLink:x.hangoutLink||'',
  organizer:x.organizer?.displayName||x.organizer?.email||'',status:x.status||''})),
  summary:{windowDays:30}};
}
async function readMeet(access){
 const out=await readApi('https://meet.googleapis.com/v2/spaces?pageSize=20',access);
 return {items:(out.spaces||[]).map(x=>({id:x.name,name:x.meetingCode||x.name,
  resourceName:x.name,url:x.meetingUri||'',activeConference:!!x.activeConference})),
  summary:{spaces:(out.spaces||[]).length}};
}
async function readChat(access){
 const out=await readApi('https://chat.googleapis.com/v1/spaces?pageSize=30',access);
 return {items:(out.spaces||[]).map(x=>({id:x.name,resourceName:x.name,
  name:x.displayName||x.name,type:x.type||''})),summary:{spaces:(out.spaces||[]).length}};
}
async function readChatMessages(access,spaceId){
 if(!/^spaces\/[A-Za-z0-9_-]{1,180}$/.test(spaceId||''))
  throw Object.assign(Error('Selecione um espaço válido do Google Chat.'),{status:400});
 const path=spaceId.split('/').map(encodeURIComponent).join('/');
 const out=await readApi('https://chat.googleapis.com/v1/'+path+'/messages?'+
  new URLSearchParams({pageSize:'20',orderBy:'createTime desc',
   fields:'messages(name,text,createTime,sender(displayName,email),thread(name))'}),access);
 return {items:(out.messages||[]).map(x=>({id:x.name,
  name:(x.sender?.displayName||x.sender?.email||'Mensagem')+' · '+(x.createTime||''),
  sender:x.sender?.displayName||x.sender?.email||'',date:x.createTime||'',
  text:String(x.text||'').slice(0,1400)})),summary:{messages:(out.messages||[]).length}};
}
async function readYouTube(access){
 const channels=await readApi('https://www.googleapis.com/youtube/v3/channels?'+
  new URLSearchParams({part:'snippet,contentDetails,statistics',mine:'true'}),access);
 const channel=(channels.items||[])[0];
 if(!channel)return {items:[],summary:{channel:null,videos:0}};
 const uploads=channel.contentDetails?.relatedPlaylists?.uploads;
 const videos=uploads?await readApi('https://www.googleapis.com/youtube/v3/playlistItems?'+
  new URLSearchParams({part:'snippet,contentDetails',playlistId:uploads,maxResults:'10'}),access):{items:[]};
 return {items:(videos.items||[]).map(x=>({id:x.contentDetails?.videoId||x.id,
  name:x.snippet?.title||'(vídeo sem título)',
  url:x.contentDetails?.videoId?'https://www.youtube.com/watch?v='+encodeURIComponent(x.contentDetails.videoId):'',
  publishedAt:x.snippet?.publishedAt||'',snippet:String(x.snippet?.description||'').slice(0,320)})),
  summary:{channel:channel.snippet?.title||'',channelId:channel.id,
   subscribers:channel.statistics?.subscriberCount||'',videos:(videos.items||[]).length}};
}
export async function readConnectedData(userId,service,id,spaceId=''){
  const provider=SERVICES[service];
  if(!provider||!/^[0-9a-f-]{36}$/i.test(id))throw Object.assign(Error('Serviço ou conexão inválidos.'),{status:400});
  const admin=adminClient();
  const row=await admin.from('openbot_connections')
   .select('id,owner_id,provider,display_name,expires_at,status,tokens_ciphertext,scopes')
   .eq('id',id).eq('owner_id',userId).eq('provider',provider).maybeSingle();
  if(row.error||!row.data)throw Object.assign(Error('Conta não encontrada para este usuário.'),{status:404});
  if(row.data.status!=='connected')throw Object.assign(Error('Esta conta precisa ser reconectada.'),{status:401});
  if(provider==='google'){
   const connectorId=service==='chat_messages'?'chat':service;
   const needed=getGoogleServiceScopes(connectorId);
   const granted=Array.isArray(row.data.scopes)?row.data.scopes:[];
   if(!needed.every(scope=>granted.includes(scope)))
    throw Object.assign(Error('Esta conta ainda não autorizou as permissões de '+connectorId+'. Clique em Conceder permissão e autorize novamente.'),{status:403});
  }
  let token=decryptToken(row.data.tokens_ciphertext);
  if(provider==='google')token=await googleRefresh(row.data,token,admin);
  if(!token?.access_token)throw Object.assign(Error('Token OAuth ausente. Reconecte esta conta.'),{status:401});
  let result={items:[],summary:{}};
  try{
   if(service==='drive'){
    const out=await readApi('https://www.googleapis.com/drive/v3/files?'+
     new URLSearchParams({pageSize:'12',fields:'nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime)',
      orderBy:'modifiedTime desc',q:'trashed = false'}),token.access_token);
    result.items=(out.files||[]).map(x=>({id:x.id,name:x.name,type:x.mimeType||'',url:x.webViewLink||'',
     modified:x.modifiedTime||''})).slice(0,12);
   }else if(service==='sheets'){
    const out=await readApi('https://www.googleapis.com/drive/v3/files?'+
     new URLSearchParams({pageSize:'12',fields:'files(id,name,mimeType,webViewLink,modifiedTime)',
      q:"mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
      orderBy:'modifiedTime desc'}),token.access_token);
    result.items=(out.files||[]).map(x=>({id:x.id,name:x.name,url:x.webViewLink||'',modified:x.modifiedTime||''})).slice(0,12);
   }else if(service==='gmail'){
    result=await readGmail(token.access_token);
   }else if(service==='calendar'){
    result=await readCalendar(token.access_token);
   }else if(service==='meet'){
    result=await readMeet(token.access_token);
   }else if(service==='chat'){
    result=await readChat(token.access_token);
   }else if(service==='chat_messages'){
    result=await readChatMessages(token.access_token,spaceId);
   }else if(service==='youtube'){
    result=await readYouTube(token.access_token);
   }else if(service==='instagram'){
    const out=await readApi('https://graph.facebook.com/v24.0/me/accounts?'+
     new URLSearchParams({fields:'id,name,instagram_business_account{id,username,name,profile_picture_url}',limit:'20'}),token.access_token);
    result.items=(out.data||[]).map(x=>({id:x.id,page:x.name,instagramId:x.instagram_business_account?.id||'',
      username:x.instagram_business_account?.username||'',name:x.instagram_business_account?.name||''})).slice(0,20);
   }
  }catch(error){
   if(error.status===401)await admin.from('openbot_connections').update({status:'needs_reconnect'})
    .eq('owner_id',userId).eq('id',id);
   throw error;
  }
  const items=(result.items||[]).slice(0,12);
  const json=JSON.stringify(items);
  if(json.length>MAX_OUTPUT)throw Object.assign(Error('A prévia excedeu o limite de segurança.'),{status:502});
  return {ok:true,service,connection:{id:row.data.id,name:row.data.display_name},
   items,summary:result.summary||{},limitedTo:'metadados e conteúdo de leitura autorizado',
   checkedAt:new Date().toISOString(),
   notice:'Prévia de dados autorizados; nenhuma mensagem, postagem, reunião ou arquivo foi criado ou alterado.'};
}
export async function GET(request){
 try{
  const {user}=await officeAuth(request);
  const u=new URL(request.url);
  const result=await readConnectedData(user.id,u.searchParams.get('service'),
   u.searchParams.get('connection_id')||'',u.searchParams.get('space_id')||'');
  return officeJson(result);
 }catch(e){return safeOfficeError(e)}
}
