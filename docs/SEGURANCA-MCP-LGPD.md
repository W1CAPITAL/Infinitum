# Segurança MCP e LGPD — INFINITUM / Killa AI

A integração OAuth de ChatGPT, Claude, Grok, OpenCode e FreeBuff deve obedecer **OAuth 2.1** com cliente autorizado, **MFA (AAL2)**, autorização individual, escopo por usuário e políticas **RLS** no Supabase. A senha é digitada na autenticação do INFINITUM, nunca como argumento da IA.

O MCP é exclusivamente de leitura e rascunhos e não envia WhatsApp. O QR dinâmico individual é exibido em `/mcp/pair` somente após login na interface do INFINITUM, sem repassá-lo ao modelo.

O banco nativo possui políticas restritivas que bloqueiam `INSERT`, `UPDATE` e `DELETE` com JWT OAuth para impedir que um cliente modificado use a Data API para escrever diretamente. Uma chave secreta privilegiada `service_role` ou `sb_secret_` pode contornar RLS e deve permanecer fora do navegador, com rotação quando necessário. O `publishable key` é público por desenho.

Os KPIs incluem exclusivamente mensagens que tenham aceite documentado do WA.Auto com ID do provedor. Minutas sem envio não contam.

Aplicar a **LGPD** (Lei 13.709/2018), minimização, finalidade, retenção adequada e isolamento de empresas. Nenhum sistema pode impedir toda engenharia reversa em código aberto ou JS executado no navegador.

Consulte [SECURITY](../SECURITY.md) e [manual MCP](./killa-mcp.md) para configurações, riscos e incidentes.
