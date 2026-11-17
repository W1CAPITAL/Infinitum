# OpenBot · Conexões do INFINITUM (web, EXE e MausBot)

## O que funciona sem chaves privadas
- OpenBot abre a central de conexões em **Aplicativos conectados**.
- Pesquisa direta do INFINITUM CRM usa a sessão Supabase do usuário, políticas RLS e somente leitura.
- ZapFast abre em uma sessão separada, inclusive no EXE, com troca de número controlada no próprio ZapFast.
- O endpoint **https://agentinfinitum.vercel.app/api/openbot/mcp** anuncia OAuth e oferece ferramentas MCP de pesquisa no CRM e status de conexões. O cliente precisa receber token OAuth e uma autorização MCP temporária.
- O EXE usa **https://agentinfinitum.vercel.app/api/openbot/desktop-config** para obter somente URL e chave pública do mesmo Supabase do CRM. As consultas que precisam das credenciais online da Vercel passam pelo relay local com allowlist e sessão verificada.

## Google: dois fluxos diferentes

### A. Login do INFINITUM via Firebase + Supabase
O login do CRM não é o mesmo OAuth usado para listar arquivos e mensagens. O Firebase fornece a identidade Google; o CRM troca o token original do Google por uma sessão Supabase e mantém as políticas RLS.

1. No projeto Firebase \`infinitum-ccb26\`, abra Authentication → Sign-in method e habilite Google.
2. Em Authentication → Settings → Authorized domains, inclua \`agentinfinitum.vercel.app\`.
3. Em Project settings → General → Your apps → INFINITUM CRM Web → SDK setup and configuration, copie os campos públicos \`apiKey\`, \`authDomain\`, \`projectId\` e \`appId\`.
4. Cadastre na Vercel, para Production e Preview, somente as variáveis públicas:
   - \`NEXT_PUBLIC_FIREBASE_API_KEY\`
   - \`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN\`
   - \`NEXT_PUBLIC_FIREBASE_PROJECT_ID\`
   - \`NEXT_PUBLIC_FIREBASE_APP_ID\`
5. No Supabase que o INFINITUM usa atualmente (\`segjskjlbeydlljnefai\`), habilite Authentication → Providers → Google usando o mesmo Web Client ID e Client Secret do projeto Google Cloud. O callback do Supabase é \`https://segjskjlbeydlljnefai.supabase.co/auth/v1/callback\`.
6. No cliente OAuth Google, inclua também o handler Firebase \`https://<authDomain>/__/auth/handler\` como URI de redirecionamento, além das origens JavaScript necessárias.

Não substitua a URL do Supabase do INFINITUM pela URL de outro projeto. O projeto Firebase é \`infinitum-ccb26\`; a sessão e os dados atuais do CRM continuam no Supabase indicado por \`NEXT_PUBLIC_SUPABASE_URL\`.

### B. Conectores Google Workspace do OpenBot
Um cliente OAuth Web atende os serviços Google, mas o OpenBot pede escopos por serviço para não solicitar Gmail, Chat ou YouTube quando a pessoa só quer conectar o Drive.

Callback OAuth do OpenBot:
\`https://agentinfinitum.vercel.app/api/openbot/integrations/oauth/callback\`

O cliente OAuth deve ter os dois callbacks de serviço e login:
- \`https://agentinfinitum.vercel.app/api/openbot/integrations/oauth/callback\`
- \`https://segjskjlbeydlljnefai.supabase.co/auth/v1/callback\`
- O handler Firebase correspondente ao \`authDomain\` mostrado na configuração do app.

Variáveis privadas na Vercel, Production e Preview:
- \`OPENBOT_GOOGLE_CLIENT_ID\`
- \`OPENBOT_GOOGLE_CLIENT_SECRET\`
- \`OPENBOT_TOKEN_CIPHER_KEY\`: 32 bytes aleatórios em Base64URL para AES-256-GCM.
- \`SUPABASE_SERVICE_ROLE_KEY\` ou \`SUPABASE_SECRET_KEY\`: segredo administrativo do Supabase, somente no servidor.

Nunca colocar segredos em \`NEXT_PUBLIC_*\`, no executável Windows, no repositório ou no navegador. O token Google é armazenado criptografado em \`openbot_connections\`.

### APIs Google que o projeto usa

Links diretos para habilitação no projeto `infinitum-ccb26`:
- [Biblioteca de APIs](https://console.cloud.google.com/apis/library?project=infinitum-ccb26)
- [Google Auth Platform · Data Access / escopos](https://console.cloud.google.com/auth/scopes?project=infinitum-ccb26)
- [Google Auth Platform · Clientes OAuth](https://console.cloud.google.com/auth/clients?project=infinitum-ccb26)
- [Firebase · INFINITUM CRM Web](https://console.firebase.google.com/project/infinitum-ccb26/settings/general)

Habilite no Google Cloud Console, projeto \`infinitum-ccb26\`:
- Google Drive API
- Google Sheets API
- Gmail API
- Google Calendar API
- Google Meet REST API
- Google Chat API
- YouTube Data API v3

### Escopos solicitados, por serviço
- Drive: \`drive.metadata.readonly\`
- Sheets: \`drive.metadata.readonly\`, \`spreadsheets.readonly\`
- Gmail: \`gmail.readonly\`
- Calendar: \`calendar.events.readonly\`
- Meet: \`meetings.space.readonly\`
- Chat: \`chat.spaces.readonly\`, \`chat.messages.readonly\`
- YouTube: \`youtube.readonly\`

O OAuth também pede \`openid\`, \`email\` e \`profile\`. Todos os escopos de dados são somente leitura. Não há envio de e-mail, publicação de vídeo, criação de reunião ou envio de mensagem no Chat.

Gmail e mensagens do Chat usam escopos restritos; Meet, Calendar, YouTube e outros podem exigir escopos sensíveis e revisão conforme a distribuição do aplicativo. Não adicionar escopos de escrita para contornar a verificação.

### Conectar uma conta
1. Abra **OpenBot → Aplicativos conectados**.
2. Selecione o serviço Google desejado.
3. Clique em **Conectar conta**. Cada serviço pede apenas as permissões de que precisa.
4. Se a mesma conta Google já estiver conectada, use **Conceder permissão** para adicionar o escopo daquele serviço.
5. Após o consentimento, volte ao OpenBot e clique em **Atualizar** e **Testar acesso**.
6. Google Chat primeiro lista os espaços; em cada espaço, use **Ler mensagens** quando precisar consultar o conteúdo. A API Chat exige conta Google Workspace Business/Enterprise com Chat ativo; contas pessoais @gmail.com não atendem ao pré-requisito documentado. A API REST do Meet também exige conta Google Workspace com Meet ativado. Se a conta for pessoal, use os links de Meet presentes nos eventos do Calendar; a consulta direta de espaços Meet pode não estar disponível.
7. Google Calendar mostra próximos eventos e links do Meet; o conector Meet lista os espaços de reunião acessíveis; YouTube mostra o canal e os últimos vídeos.

## Estado OAuth e limites de teste
O projeto Google Cloud foi visto em modo **Testing**, tipo **External**, com \`corporacaow1capital@gmail.com\` na lista de usuários de teste. Nesse modo, apenas usuários de teste autorizam o app e os consentimentos de escopos de dados expiram após sete dias. Aumentar a lista de testadores não equivale a publicar/verificar o app. Para uso amplo, revisar branding, página inicial, política de privacidade, justificativas de escopo e processo de verificação do Google.

## Composio: Instagram e WhatsApp Business (Vercel)

O OpenBot usa a API do Composio no servidor remoto da Vercel. Configure somente:
- `COMPOSIO_API_KEY` como variável **Sensitive** no projeto Vercel `projectw1sc-crm`, em Production, Preview e Development.
- Não usar `NEXT_PUBLIC_COMPOSIO_API_KEY`, não incluir a chave no GitHub, no EXE, em logs ou no navegador.

A central **OpenBot → Aplicativos conectados** inicia o Composio Connect Link para:
- Instagram: exige conta profissional Business ou Creator.
- WhatsApp: o toolkit Composio usa WhatsApp Business API e exige uma conta WABA; não conecta WhatsApp pessoal por QR Code. Para sessão QR pessoal, manter o ZapFast remoto como conector separado.

O Composio armazena e atualiza os tokens OAuth. O INFINITUM guarda apenas o vínculo entre o usuário autenticado e a sessão/conta remota. As chamadas saem da Vercel; o PC e o EXE apenas usam o relay HTTPS autenticado.

O MCP `/api/openbot/mcp` disponibiliza `composio_search_tools` e `composio_execute_tool`, restritas aos toolkits Instagram e WhatsApp. Ações de escrita exigem permissão de edição supervisionada e aprovação do Composio; quando o cliente MCP não suporta aprovação interativa, a execução deve ser negada. Nenhuma API key do Composio é enviada ao cliente MCP.

A callback do Connect Link é `https://agentinfinitum.vercel.app/api/openbot/composio/callback`. O estado é de uso único, vinculado ao usuário e ao ID de conta devolvido pelo Composio.

## Ativação única de Instagram/Meta
Crie e aprove um aplicativo no **Meta for Developers**, configure o mesmo redirect e ative os produtos/permissões de contas profissionais. Configure no servidor:
- \`OPENBOT_META_APP_ID\`
- \`OPENBOT_META_APP_SECRET\`
- Chave AES e Supabase Admin (acima).
O teste de acesso lê páginas e contas Instagram profissionais vinculadas; não posta nem lê mensagens privadas sem escopos e implementação específicos.

## Conectar um OpenMausBot externo por MCP HTTP
1. No Supabase do CRM, habilite **Authentication → OAuth Server → OAuth 2.1**, consentimento em \`/oauth/consent\` e registro de clientes compatível com seu ambiente.
2. No OpenMausBot, adicione um servidor MCP remoto HTTP:
   \`https://agentinfinitum.vercel.app/api/openbot/mcp\`
3. No fluxo OAuth, faça login com a mesma conta do INFINITUM, confirme MFA e aprove explicitamente o cliente na tela de consentimento. Isso cria uma autorização de leitura por até 30 dias.
4. O OpenMausBot poderá chamar \`crm_search_clients\`, \`crm_search_processes\` e \`openbot_connections_status\` após receber token OAuth válido. Não há ferramentas de envio de WhatsApp, Gmail ou Instagram.
5. Acesse **Aplicativos conectados → MCP** para conferir clientes e revogar acessos.
6. Se o Supabase OAuth Server não estiver habilitado, a descoberta/pareamento MCP não será concluída; não apresentar esta etapa como conexão pronta.

## Segurança e limites
- As tabelas \`openbot_connections\`, \`openbot_oauth_states\` e \`openbot_mcp_grants\` têm RLS e nenhuma leitura anônima; as credenciais dos provedores ficam criptografadas em repouso com AES-256-GCM.
- Tokens OAuth não são armazenados em navegador nem no executável Windows.
- O Windows usa navegador padrão para consentimento do Google/Meta. O próprio OpenBot pode atualizar o estado ao receber foco.
- Para trocar o WhatsApp, o ZapFast exige confirmação e limpeza da sessão anterior antes de vincular outro número. Não compartilhar uma sessão entre empresas.
- As opções GitHub, Outlook e Slack aparecem como **Ainda indisponível** até terem seus próprios conectores oficiais.
- O Exe de CI pode ser não assinado; não contorne o Defender. Para distribuição pública, requer assinatura de código e validação no Windows.
