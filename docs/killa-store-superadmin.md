# W1 Capital App Store — administração superadmin

## Acesso independente da Vercel

Abra o Killa Launcher → Administração · Build Logs / Typecheck / Env. O launcher abre `/app-store/admin` pelo Next.js local, e a página consulta `killa-store-admin` no Supabase Edge.

Somente uma conta explicitamente autorizada em `killa_private.killa_store_superadmins`, com vínculo `crm_memberships` admin ativo, consegue acessar. Essa autorização não é concedida a administradores comuns. O backend verifica **todas as requisições** independentemente da interface.

## MFA gratuito

Supabase Auth TOTP em AAL2. Compatível com Google Authenticator, Duo Mobile e Oracle Mobile Authenticator configurados para TOTP. A página permite cadastrar um fator e verificar seis dígitos. O QR TOTP é particular e não é o QR do WhatsApp. A função também verifica a sessão ainda existente em `auth.sessions` e exige **TOTP confirmado nos últimos cinco minutos antes de publicar**.

## Seções

- **Build Logs:** histórico de execuções, commit, conclusão, link GitHub.
- **Typecheck:** etapas de validação compilação/testes, inclusive falhas.
- **Logs:** etapas estruturadas sem log bruto; conteúdo integral só pelo GitHub autenticado.
- **Env:** exclusivamente presença/ausência de configurações. Nenhum valor, senha ou segredo é retornado.
- **Publicações:** solicitar versão, confirmar texto exato e novo TOTP, com GitHub protegido.
- **Auditoria:** decisões e mudanças de permissão gravadas no schema privado.

## MCP (fora do modo Work)

URL: `https://ulkuhiibeoibbzhqrfya.supabase.co/functions/v1/killa-store-admin/mcp`

Ferramentas: `killa_store_status`, `killa_store_build_logs`, `killa_store_request_release`, `killa_store_request_status`. Todas exigem superadmin, AAL2, cliente OAuth identificado, ID explicitamente permitido e ativação individual na aba Env. O MCP **não tem ferramenta de aprovação**.

Para conectar ChatGPT, Grok ou Claude, o cliente precisa aceitar MCP remoto com OAuth e o OAuth Server do projeto Supabase deve estar ativado; essa configuração ainda depende do administrador. Alternativa imediata: o conector GitHub já permite ao ChatGPT consultar execuções, modificar código via PR e revisar erros sem dar acesso à Env.

## Publicação sem acesso irrestrito

1. IA ou operador solicita uma versão (pedido expira em uma hora). Nada é publicado.
2. Superadmin com login e AAL2 abre a solicitação, digita `PUBLICAR x.y.z` e valida novo TOTP.
3. Se o Supabase Edge tiver `KILLA_GITHUB_DISPATCH_TOKEN` como segredo privado, dispara `workflow_dispatch` na branch `main`. Falha incerta não gera nova tentativa automática.
4. O workflow exige ambiente GitHub `desktop-production`, revisores e `KILLA_ED25519_PRIVATE_KEY_B64` guardado no GitHub Actions. Sem isso, não sai release assinada.

Configure o token com a menor permissão possível (Actions: write no repositório exato), proteja main e exija aprovadores no ambiente. Tokens nunca pertencem ao EXE, frontend, banco nem resultados de ferramentas MCP.

Se a chave privada Ed25519 foi compartilhada em conversa ou arquivo, trate-a como potencialmente exposta e **faça rotação antes da primeira release oficial**. Não a cole no ChatGPT. Confirmação Ed25519 não é certificado Authenticode Windows.

Nenhuma configuração torna um sistema impossível de comprometer: quem controla as credenciais administrativas, a assinatura ou a infraestrutura ainda pode alterar o ambiente. Os controles visam reduzir risco e detectar uso indevido.
