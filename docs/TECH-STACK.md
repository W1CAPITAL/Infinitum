# INFINITUM — linguagens, tecnologias e arquitetura

Atualizado em 16/11/2026. Este documento descreve as tecnologias identificadas nos arquivos versionados e nas configurações atuais do repositório. Ele não substitui a inspeção de código, a configuração do ambiente ou a validação de produção.

## Linguagens efetivamente utilizadas

| Linguagem / formato | Onde aparece | Responsabilidade |
| --- | --- | --- |
| **JavaScript (ESM)** | `.js`, `.mjs`, `package.json` com `type: module` | Lógica do CRM, APIs, integrações, scripts de build e processo principal do Electron |
| **JSX** | Componentes React em `.jsx` | Composição das telas e componentes da aplicação |
| **JavaScript CommonJS** | Arquivos `.cjs` | Preload e pontos que precisam do formato CommonJS do Node/Electron |
| **HTML5** | Launcher Windows e páginas estáticas | Estrutura da interface do launcher |
| **CSS3** | Estilos da aplicação e do launcher | Layout, responsividade, temas e identidade visual |
| **SQL / PostgreSQL** | Migrações em `supabase/migrations/` e consultas do backend | Tabelas, índices, funções, permissões e políticas RLS |
| **JSON** | `package.json`, configurações e dados de integração | Dependências, scripts, configuração e payloads |
| **YAML** | `.github/workflows/*.yml` | CI, build Windows e publicação controlada |
| **PowerShell** | Scripts `.ps1` de validação Windows | Verificação de assinatura Authenticode e tarefas específicas do Windows |
| **Markdown** | `README.md` e `docs/` | Documentação técnica e operacional |
| **SVG / PNG / ICO** | `public/branding/` e `desktop/branding/` | Identidade visual e ícones |

### TypeScript: uso correto da nomenclatura

O pacote raiz instala **TypeScript 5.9.3** e executa `tsc --project tsconfig.typecheck.json --noEmit`. A configuração usa `allowJs: true` e `checkJs: true`, incluindo arquivos JavaScript e módulos `.mjs`. Portanto, o TypeScript atua como **verificador estático de JavaScript**. Não se deve afirmar que o aplicativo é escrito em TypeScript nem que existem fontes `.ts` / `.tsx` sem confirmar esses arquivos no repositório.

## Versões principais verificadas

| Componente | Versão / requisito | Uso |
| --- | --- | --- |
| Node.js | `>=22` no pacote raiz; CI Windows usa Node `24` | Build, scripts e execução |
| Next.js | `15.5.29` | Aplicação web e servidor standalone |
| React / React DOM | `19.1.2` | Interface |
| TypeScript | `5.9.3` | Checagem estática de JavaScript |
| Supabase JS | `2.119.0` | Auth, banco e integrações no cliente |
| Google Auth Library | `9.15.1` | Autenticação e integrações Google no servidor |
| Firebase | `13.3.0` | SDK e serviços Firebase usados pelo projeto |
| lucide-react | `0.468.0` | Ícones da interface |
| read-excel-file | `9.3.10` | Leitura de planilhas Excel |
| qrcode | `1.5.4` | Geração de QR codes |
| jsdom | `26.1.0` | Ambiente de testes DOM |
| Electron | `45.3.2` | Aplicativo Windows |
| electron-builder | `26.18.0` | Empacotamento NSIS x64 |
| electron-updater | `6.8.11` | Canal de atualização compatível com as políticas de assinatura |
| PostgreSQL | Serviço gerenciado pelo Supabase | Persistência e autorização |

As versões acima vêm dos manifestos `package.json` e `desktop/package.json`. A versão de PostgreSQL é gerenciada pelo projeto Supabase e não é fixada pelo pacote npm.

## Arquitetura em camadas

### Aplicação web

- `app/`: rotas e páginas Next.js.
- `components/`: componentes React/JSX compartilhados.
- `lib/`: lógica de negócio, validações e integrações JavaScript.
- `public/`: recursos estáticos e identidade visual.
- Next.js fornece a camada web e as rotas de servidor; React compõe a interface.

### Aplicativo Windows

O desktop não é um site dentro do Edge. Ele usa **Electron**, inicia um servidor Next.js standalone local e abre a interface no Chromium embarcado do Electron.

- `desktop/main.mjs`: processo principal Electron, inicialização e ciclo de vida.
- `desktop/preload.cjs`: ponte mínima e controlada entre a janela e o processo principal.
- `desktop/runtime-policy.mjs`: políticas de origem, navegação e configuração pública.
- `desktop/launcher.html`, `launcher.css`, `launcher-ui.js`: interface local do launcher.
- `desktop/stage-standalone.mjs`: prepara os arquivos standalone para empacotamento.
- `desktop/verify-packaged-server.mjs`: testa o payload real empacotado no Windows.
- `desktop/package.json`: configuração do Electron Builder e instalador NSIS.

O instalador não exige Node.js instalado no computador do usuário. O build inclui o runtime e os arquivos necessários ao servidor standalone.

### Dados e autenticação

- Supabase fornece PostgreSQL, Auth, Storage e Realtime.
- Políticas RLS e verificações no servidor limitam o acesso aos dados autorizados.
- Migrações SQL em `supabase/migrations/` são a fonte versionada da estrutura do banco.
- Edge Functions hospedam serviços remotos, como o endpoint MCP documentado em `docs/killa-mcp.md`.
- Chaves privilegiadas não devem ser incluídas no navegador, no EXE, em arquivos públicos ou em commits.

### Deploy e automação

- Vercel hospeda a aplicação web conectada ao repositório.
- GitHub Actions executa testes, typecheck, build e o pipeline Windows.
- O instalador piloto sem Authenticode é um artefato de teste; não equivale a uma release Windows assinada e confiável.

## Comandos de desenvolvimento

Na raiz:

```bash
npm install
npm run dev
npm test
npm run test:dom
npm run typecheck
npm run build
```

Build desktop no Windows, a partir da raiz do repositório:

```powershell
npm install
$env:KILLA_DESKTOP_STANDALONE="1"
npm run build
node desktop/stage-standalone.mjs
npm install --prefix desktop
npm --prefix desktop run pack:win
node desktop/verify-packaged-server.mjs
npm --prefix desktop run dist:win
```

O workflow oficial de teste é `.github/workflows/killa-desktop-windows.yml`. Ele usa Windows, Node 24, executa testes e typecheck, constrói o Next standalone, testa o EXE empacotado e gera o instalador NSIS x64.

## Integrações: estado documentado sem suposições

A configuração desktop em `desktop/runtime-policy.mjs` ainda fixa `WA_AUTO_URL` em `https://lexispredict-wa-auto.onrender.com`. O domínio do ZapFast está na lista de destinos externos permitidos pelo Electron, mas isso só permite abrir o site no navegador padrão: **não significa que o ZapFast já esteja integrado à caixa de entrada `/whatsapp` do CRM**.

A conexão efetiva entre empresas, sessões WhatsApp e histórico precisa ser validada na implementação e no backend antes de ser descrita como concluída. Não compartilhar uma sessão global entre empresas. O histórico deve obedecer ao escopo de empresa/usuário e às políticas de acesso do banco.

## Segurança e distribuição

- Não desative o Defender ou o SmartScreen para instalar um build de teste.
- O artefato `infinitum-killa-windows-test-UNSIGNED` não possui assinatura Authenticode confiável.
- A assinatura Ed25519 do manifesto de atualização e a assinatura Authenticode do executável são controles diferentes.
- Releases públicas Windows devem passar pelo workflow de assinatura e pela validação da cadeia de confiança antes de serem distribuídas como versão final.
- O workflow de publicação exige certificado Authenticode configurado como segredo no ambiente GitHub protegido `desktop-production`.

## Fontes de verdade no repositório

- `package.json`
- `desktop/package.json`
- `tsconfig.typecheck.json`
- `desktop/main.mjs`
- `desktop/preload.cjs`
- `desktop/runtime-policy.mjs`
- `.github/workflows/killa-desktop-windows.yml`
- `.github/workflows/killa-desktop-signed-release.yml`
- `supabase/migrations/`
- `docs/killa-mcp.md`
- `desktop/README.md`
