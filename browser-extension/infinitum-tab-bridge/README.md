# INFINITUM · Ponte Local para WhatsApp Web

Extensão própria, gratuita e de permissões mínimas, inspirada no **empréstimo explícito de abas** do BrowserSkill e nas **autorizações auditáveis** do OpenBot. Não inclui o servidor completo do CopilotKit/OpenBot nem executa controle remoto geral de tela.

## O que faz

- Permite vincular **uma aba do WhatsApp Web que já está aberta e conectada** ao INFINITUM sem criar outra sessão nem solicitar outro QR.
- A permissão é dada no popup da extensão pelo operador, **expira após 60 minutos**, e pode ser revogada.
- Na tela **WhatsApp** do INFINITUM, o botão **Ler conversa aberta** lê no máximo 8 mensagens visíveis e apenas o título do chat atual. Não faz uma varredura nas conversas.
- Pode sugerir um rascunho usando o **Qwen local já disponível no INFINITUM** (caso o modelo esteja carregado), sem pagar por outro servidor.
- **Preparar no WhatsApp Web** insere texto na caixa de digitação somente se a conversa ainda tiver o mesmo título e a caixa estiver vazia. **Não clica no botão de envio.**
- Não lê cookies, tokens, dados de outras abas, banco interno, anexos ou contatos em lote. Nenhum histórico extra é enviado ao Supabase nesta ponte.
- Funciona somente enquanto o navegador e a aba WhatsApp Web estiverem abertos no próprio PC.

## Instalação no computador

1. Baixe a pasta `browser-extension/infinitum-tab-bridge` completa, mantendo todos os arquivos juntos (no GitHub, use a opção Download ZIP do repositório e extraia essa pasta).
2. No Chrome ou Edge, abra `chrome://extensions` ou `edge://extensions`.
3. Ative **Modo do desenvolvedor**, clique **Carregar sem compactação** e selecione **a pasta extraída `infinitum-tab-bridge`** que contém `manifest.json`.
4. Mantenha o WhatsApp Web aberto e conectado em `https://web.whatsapp.com/`.
5. Clique no ícone **INFINITUM • Ponte Local** na barra do navegador, selecione a aba WhatsApp Web e escolha **Autorizar aba escolhida**.
6. Abra o INFINITUM **sempre em** `https://agentinfinitum.vercel.app/whatsapp`. Em **OpenBot · WhatsApp Web já aberto no computador**, clique **Conectar aba do PC**, depois **Verificar extensão** e **Ler conversa aberta**.
7. Opcionalmente, edite um rascunho ou gere uma sugestão com Qwen e clique em **Preparar no WhatsApp Web**. Confira a conversa e envie manualmente na aba WhatsApp.

## Limitações e segurança

- **Não instala sozinha.** A Vercel não pode ativar uma extensão ou acessar sessões e abas do PC sem instalação e autorização local.
- Não há controle de tela, navegação livre, execução arbitrária de JavaScript, extração de credenciais, leitura de grupos ou envio autônomo.
- A estrutura interna e os seletores do WhatsApp Web podem mudar, causando falha na leitura ou no preenchimento. Se isso acontecer, a ponte deve mostrar erro e não enviar nada.
- Não identifique um cliente apenas pelo nome mostrado na aba. Confirme cadastro e processo no INFINITUM antes de responder sobre andamento, decisão ou pagamento.
- A automação por interface web, mesmo local e limitada, pode ter riscos de restrição da conta WhatsApp e não substitui a API oficial da Meta.
- Extensão reconhece **exclusivamente** `https://web.whatsapp.com` e `https://agentinfinitum.vercel.app`. Abas de outros sites estão fora do escopo.
- Para desligar, use **Desconectar** no popup, feche a aba ou remova a extensão.

## Referências (inspiração, não código copiado)

- [CopilotKit/OpenBot](https://github.com/CopilotKit/OpenBot): políticas, aprovações e registro de ações.
- [Tencent/BrowserSkill](https://github.com/Tencent/BrowserSkill): empréstimo explícito de aba do navegador existente.
- [Microsoft Playwright Extension](https://github.com/microsoft/playwright/tree/main/packages/extension): reutilização da sessão do Chrome sem novo navegador.
- [Officially-aditya/browserControl](https://github.com/Officially-aditya/browserControl): pausa e autorização de controle local.

A implementação aqui é original e **não depende do backend OpenBot, Docker, Render, MCP local, Python ou servidores pagos**.
