// Each connector requests only the scopes needed by the selected service.
// Google access is read-only. The same Google account can grant additional
// services incrementally without asking for unrelated Workspace permissions.
const GOOGLE_BASE_SCOPES=Object.freeze(['openid','email','profile']);
export const GOOGLE_CONNECTOR_SCOPES=Object.freeze({
 drive:Object.freeze(['https://www.googleapis.com/auth/drive.metadata.readonly']),
 sheets:Object.freeze(['https://www.googleapis.com/auth/drive.metadata.readonly','https://www.googleapis.com/auth/spreadsheets.readonly']),
 gmail:Object.freeze(['https://www.googleapis.com/auth/gmail.readonly']),
 calendar:Object.freeze(['https://www.googleapis.com/auth/calendar.events.readonly']),
 meet:Object.freeze(['https://www.googleapis.com/auth/meetings.space.readonly']),
 chat:Object.freeze(['https://www.googleapis.com/auth/chat.spaces.readonly','https://www.googleapis.com/auth/chat.messages.readonly']),
 youtube:Object.freeze(['https://www.googleapis.com/auth/youtube.readonly'])
});
export const GOOGLE_OAUTH_SCOPES=Object.freeze([
 ...new Set([...GOOGLE_BASE_SCOPES,...Object.values(GOOGLE_CONNECTOR_SCOPES).flat()])
]);
export function getGoogleScopes(connectorId){
 const scopes=GOOGLE_CONNECTOR_SCOPES[connectorId];
 if(!scopes)throw Error('Serviço Google indisponível.');
 return [...GOOGLE_BASE_SCOPES,...scopes];
}
export function getGoogleServiceScopes(connectorId){
 const scopes=GOOGLE_CONNECTOR_SCOPES[connectorId];
 if(!scopes)throw Error('Serviço Google indisponível.');
 return [...scopes];
}
export const OPENBOT_CONNECTORS=Object.freeze([
 {id:'crm',provider:'crm',name:'INFINITUM CRM',category:'Trabalho',description:'Clientes e processos autorizados, pesquisa somente leitura',icon:'building-2',features:['Pesquisar cliente','Consultar processo'],mode:'native'},
 {id:'drive',provider:'google',name:'Google Drive',category:'Google Workspace',description:'Listar arquivos e metadados',icon:'hard-drive',features:['Arquivos','Pastas'],mode:'oauth'},
 {id:'sheets',provider:'google',name:'Google Sheets',category:'Google Workspace',description:'Encontrar planilhas no Drive',icon:'table-2',features:['Planilhas'],mode:'oauth'},
 {id:'gmail',provider:'google',name:'Gmail',category:'Google Workspace',description:'Consultar marcadores e mensagens recentes, sem enviar e-mails',icon:'mail',features:['Marcadores','Mensagens'],mode:'oauth'},
 {id:'calendar',provider:'google',name:'Google Calendar',category:'Google Workspace',description:'Consultar próximos compromissos e links de reunião',icon:'calendar-days',features:['Eventos','Meet'],mode:'oauth'},
 {id:'meet',provider:'google',name:'Google Meet',category:'Google Workspace',description:'Requer conta Google Workspace com Meet ativado; consulta espaços e metadados de reuniões autorizadas',icon:'video',features:['Reuniões','Links'],mode:'oauth'},
 {id:'chat',provider:'google',name:'Google Chat',category:'Google Workspace',description:'Requer Google Workspace Business/Enterprise; consulta espaços e mensagens, sem enviar mensagens',icon:'message-square',features:['Espaços','Mensagens'],mode:'oauth'},
 {id:'youtube',provider:'google',name:'YouTube',category:'Google Workspace',description:'Consultar canal e vídeos publicados, sem publicar ou editar',icon:'youtube',features:['Canal','Vídeos'],mode:'oauth'},
 {id:'instagram',provider:'composio',name:'Instagram · Composio',category:'Redes sociais',description:'Conecte Instagram Business ou Creator por OAuth gerenciado pelo Composio; leitura e ações disponíveis conforme permissões',icon:'instagram',features:['Contas profissionais','Publicações','Comentários'],mode:'composio',composioToolkit:'instagram'},
 {id:'instagram_meta',provider:'meta',name:'Instagram · Meta direto',category:'Redes sociais',description:'Conexão OAuth Meta já existente; mantenha para contas previamente autorizadas',icon:'instagram',features:['Contas profissionais','Páginas'],mode:'oauth'},
 {id:'whatsapp',provider:'composio',name:'WhatsApp Business · Composio',category:'Mensagens',description:'Conecte uma conta WhatsApp Business (WABA) por OAuth gerenciado pelo Composio',icon:'message-circle',features:['Conversas','Mensagens','Modelos'],mode:'composio',composioToolkit:'whatsapp'},
 {id:'zapfast',provider:'zapfast',name:'WhatsApp · ZapFast QR',category:'Mensagens',description:'Sessão QR remota do ZapFast. Independente do Composio e sem compartilhar o número com o CRM',icon:'message-circle',features:['Abrir ZapFast','Trocar número'],mode:'separate'},
 {id:'github',provider:'github',name:'GitHub',category:'Desenvolvimento',description:'Integração OAuth própria ainda não configurada',icon:'github',features:['Repositórios'],mode:'planned'},
 {id:'outlook',provider:'microsoft',name:'Microsoft Outlook',category:'Trabalho',description:'Requer registro OAuth Microsoft',icon:'at-sign',features:['Email'],mode:'planned'},
 {id:'slack',provider:'slack',name:'Slack',category:'Equipe',description:'Requer aplicativo Slack aprovado',icon:'messages-square',features:['Canais'],mode:'planned'}
]);
export const CONNECTOR_IDS=Object.freeze(OPENBOT_CONNECTORS.map(c=>c.id));
export const META_OAUTH_SCOPES=Object.freeze(['pages_show_list','pages_read_engagement','instagram_basic']);
export function getConnector(id){return OPENBOT_CONNECTORS.find(x=>x.id===id)||null}
export function providerConfigured(provider,env=process.env){
 if(provider==='crm'||provider==='zapfast')return true;
 if(provider==='composio')return Boolean(env.COMPOSIO_API_KEY);
 const storageReady=Boolean((env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY)
  &&env.NEXT_PUBLIC_SUPABASE_URL&&env.OPENBOT_TOKEN_CIPHER_KEY);
 if(provider==='google')return storageReady&&Boolean(env.OPENBOT_GOOGLE_CLIENT_ID&&env.OPENBOT_GOOGLE_CLIENT_SECRET);
 if(provider==='meta')return storageReady&&Boolean(env.OPENBOT_META_APP_ID&&env.OPENBOT_META_APP_SECRET);
 return false;
}
export function connectorCatalog(env=process.env){
 return OPENBOT_CONNECTORS.map(c=>({
  ...c,scopes:c.provider==='google'?getGoogleServiceScopes(c.id):[],
  configured:c.mode==='oauth'||c.mode==='composio'?providerConfigured(c.provider,env):c.mode==='native'||c.mode==='separate',
  state:c.mode==='native'?'native':c.mode==='separate'?'separate':c.mode==='planned'?'not_supported':
   providerConfigured(c.provider,env)?'ready_to_connect':'requires_app_configuration'
 }));
}
export function authorizationUrl(provider,{clientId,redirectUri,state,challenge,connectorId}){
 if(provider==='google'){
  const scopes=getGoogleScopes(connectorId||'drive');
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  Object.entries({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:scopes.join(' '),
   state,access_type:'offline',prompt:'consent select_account',include_granted_scopes:'true',
   code_challenge:challenge,code_challenge_method:'S256'}).forEach(([k,v])=>u.searchParams.set(k,v));
  return u.toString();
 }
 if(provider==='meta'){
  const u=new URL('https://www.facebook.com/v24.0/dialog/oauth');
  Object.entries({client_id:clientId,redirect_uri:redirectUri,response_type:'code',
   scope:META_OAUTH_SCOPES.join(','),state}).forEach(([k,v])=>u.searchParams.set(k,v));
  return u.toString();
 }
 throw Error('Provedor OAuth não suportado.');
}
