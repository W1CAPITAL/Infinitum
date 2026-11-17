<div align="center">

<!-- Símbolo branco: legível no tema escuro do GitHub -->
<img src="./public/branding/infinitum-symbol-branco.svg" alt="INFINITUM" width="140" />

# INFINITUM

**Plataforma de inteligência operacional, CRM jurídico e automação de carteiras**

Organização de clientes, processos, atendimentos, captção de leads e rotinas de trabalho em um único ambiente — com foco em rastreabilidade, DataJud/DJEN e produtividade.

[**Acessar a aplicação**](https://projectw1sc-crm.vercel.app)

**Licença atual:** Proprietária W1 Capital (16/11/2026). Distribuições anteriores sob MIT mantêm os direitos então concedidos. Copyright © 2026 W1 Capital.

[![Licença: Proprietária](https://img.shields.io/badge/licença-Proprietária-741b40)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15.5.29-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E)](https://supabase.com/)
[![Electron](https://img.shields.io/badge/Electron-45.3.2-47848F)](https://www.electronjs.org/)

<br/>

<!-- Logo horizontal (preto) — melhor em fundo claro / light mode -->
<img src="./public/branding/infinitum-horizontal-preto.png" alt="INFINITUM logotipo" width="320" />

</div>

---

## W1 Capital App Store — Launcher Windows

[Console privativo de superadmin, diagnósticos e MCP](docs/killa-store-superadmin.md).

O launcher Windows inclui as marcas oficiais W1 Capital e INFINITUM, e instala/atualiza o programa local sem consultar a Vercel. O canal gratuito usa releases específicas aprovadas pela W1, assinatura Ed25519 e hash SHA-512; não executa o ZIP da main. Atualizações aprovadas são baixadas e aplicadas automaticamente quando o programa não está aberto, com opção de desligar.

Veja o [manual da central de aplicativos](desktop/README.md). A primeira versão oficial exige que o administrador configure o segredo de assinatura e aprove uma release no GitHub Actions. As versões piloto anteriores precisam de atualização manual. A assinatura própria gratuita não elimina alertas SmartScreen de Windows.
## Aplicativo Windows sem Vercel

O INFINITUM possui um [projeto de instalador Windows](desktop/README.md) que distribui o próprio servidor Next.js local dentro do Electron. Cada funcionário entra pela conta individual do Supabase e recebe eventos autorizados de WhatsApp, histórico e recibos MCP em tempo real.

O **MCP independente** continua em `https://ulkuhiibeoibbzhqrfya.supabase.co/functions/v1/killa-mcp`. A leitura e o QR somente podem ser liberados para usuário autenticado. A autenticação de aplicativos terceiros exige habilitar OAuth Server no Supabase. O instalador piloto não inclui chaves administrativas ou configuração de assinatura automática.

## Killa AI / OpenBot — MCP por usuário

**MCP sem Vercel:** `https://ulkuhiibeoibbzhqrfya.supabase.co/functions/v1/killa-mcp` (Supabase Edge Function; independente dos builds do frontend).

[Configurar MCP](https://agentinfinitum.vercel.app/mcp/setup) · [Vincular WhatsApp por QR individual](https://agentinfinitum.vercel.app/mcp/pair) · [KPI de atendimentos](https://agentinfinitum.vercel.app/report) · [Manual técnico](./docs/killa-mcp.md) · [Política de segurança](./SECURITY.md)

O servidor MCP remoto exige uma conta do INFINITUM autenticada por OAuth 2.1, MFA/AAL2, habilitação administrativa e `client_id` do aplicativo registrado na lista permitida. Cada usuário só lê seu arquivo de WhatsApp e, na carteira compartilhada Lexis, dados vinculados à empresa autorizada. **O envio por MCP exige autorização humana individual com MFA:** a IA solicita, o operador confere no INFINITUM e o Edge Function encaminha ao WA.Auto apenas após confirmação. O QR pode ser exibido como imagem a clientes MCP aprovados exclusivamente quando o administrador ativa essa opção sensível.

A proteção vale também contra clientes modificados: o PostgreSQL possui políticas RLS restritivas para impedir gravação direta com JWT OAuth e não concede escrita anônima às tabelas operacionais existentes. Isso não impede a ação de um administrador do banco nem protege se uma chave secreta privilegiada vazar.

O painel de KPI de atendimento OpenBot apresenta somente mensagens com aceite do provedor e registro verificável. Sem essa fonte, informa que não há contagem confirmada. Não confunde rascunhos com atendimento concluído.

**Licença:** material novo INFINITUM sob termos proprietários W1 Capital; concessões MIT de versões anteriores seguem válidas. LexisPredict tem licença proprietária independente. Consulte [NOTICE](./NOTICE.md). A exposição do código no GitHub não permite garantir proteção absoluta contra engenharia reversa.

## Sobre o projeto

O **INFINITUM** é a evolução do ambiente operacional W1 Capital / ProjectW1SC: uma plataforma para reunir carteira de clientes, processos judiciais, retornos, tarefas, captção e registros de atendimento em um fluxo claro e auditável.

A proposta é permitir que cada pessoa saiba **o que precisa fazer, por que aquilo é prioridade e o que já aconteceu em cada acompanhamento**. O sistema combina carteira centralizada, histórico de atividades, filtros operacionais, indicadores e consultas a fontes públicas (DataJud e DJEN), respeitando os limites de cada origem.

Não substitui a conferência de documentos originais nem presume pagamentos, movimentações ou contatos que não foram confirmados.

### Identidade visual

| Asset | Uso |
| --- | --- |
| `public/branding/infinitum-symbol-preto.svg` | Símbolo infinito (fundo claro) |
| `public/branding/infinitum-symbol-branco.svg` | Símbolo infinito (fundo escuro) |
| `public/branding/infinitum-horizontal-preto.png` | Logotipo horizontal completo |
| `public/branding/logo-ia-infinitum-branco.png` | Variante IA / wordmark branco |
| `public/branding/leadbroker-logotipo-preto.png` | Lead Broker (parceiro / módulo de leads) |
| `public/branding/leadbroker-logotipo-branco.png` | Lead Broker (fundo escuro) |

---

## Funcionalidades

| Área | O que você encontra |
| --- | --- |
| **Visão geral** | Indicadores da carteira, gráficos, retornos e acesso rápido aos acompanhamentos. |
| **Tarefas** | Fila de prioridades, vencimentos, registro de atendimento, edição e histórico. |
| **Clientes** | Cadastro, busca, filtros, detalhes das negociações e acompanhamento individual. |
| **Processos** | Cadastro de números CNJ e consultas às fontes públicas DataJud e DJEN. |
| **Captção / Leads** | Fluxos de entrada e integração com operações de lead (Lead Broker). |
| **Finalizados** | Registros encerrados, histórico e reabertura justificada. |
| **Instituições** | Financeiras, bancos, assessorias, contatos e imagens institucionais. |
| **Minhas atividades** | Registro e edição de atividades, com vínculo opcional a clientes e processos. |
| **Relatórios** | Resumos operacionais, indicadores por período, exportação e PDF. |
| **Configurações** | Preferências da conta, senha, foto, temas, cores e imagem de fundo. |
| **Integrações** | WhatsApp (bridge/status), Office AI, sincronização e scanners. |

Além das áreas principais: importação de Excel, origem dos registros e personalização visual sem alterar os dados da carteira.

---

## Tecnologias e linguagens

O INFINITUM combina **JavaScript/JSX, HTML5, CSS3, SQL/PostgreSQL, YAML, JSON e PowerShell**. O TypeScript 5.9.3 é usado para checagem estática dos arquivos JavaScript (`allowJs` e `checkJs`); não é correto classificar o código atual como uma aplicação escrita em TypeScript sem fontes `.ts` ou `.tsx` confirmadas.

| Camada | Tecnologia |
| --- | --- |
| Aplicação web | Next.js 15.5.29, React 19.1.2, JavaScript/JSX |
| Servidor e scripts | Node.js 22+ (CI Windows Node 24), JavaScript ESM |
| Desktop Windows | Electron 45.3.2, electron-builder 26.18.0, NSIS x64 |
| Atualizações | electron-updater 6.8.11, validação Ed25519/SHA-512 e Authenticode nas releases assinadas |
| Banco e autenticação | Supabase, PostgreSQL, SQL, Auth, RLS, Storage e Realtime |
| Automação | GitHub Actions, YAML e PowerShell |
| Interface | HTML5, CSS3, JSX e JavaScript |

A documentação detalhada de linguagens, versões, arquitetura, scripts e build está em [`docs/TECH-STACK.md`](./docs/TECH-STACK.md).

---
 
## Executar localmente

Requisitos: **Node.js 22+**, Git e um projeto Supabase configurado.

```bash
git clone https://github.com/ProjectW1SC/INFINITUM.git
cd INFINITUM
npm install
```

Crie `.env.local` a partir de `.env.example`:

```powershell
Copy-Item .env.example .env.local
```

```bash
npm run dev
```

Abra `http://localhost:3000`. Sem Supabase e conta autorizada, as áreas protegidas não terão dados.

### Variáveis de ambiente

Consulte [`.env.example`](./.env.example). Principais:

| Variável | Finalidade |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública (navegador + RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (somente servidor) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Credencial de planilhas (se houver) |
| `GOOGLE_SHEETS_IDS` | IDs das planilhas permitidas |
| `CRON_SECRET` | Proteção de rotas automatizadas |

**Nunca** publique `.env.local`, senhas ou chaves privilegiadas. Prefixo `NEXT_PUBLIC_` é exposto ao browser.

---

## Banco de dados e autenticação

Estruturas em [`supabase/migrations/`](./supabase/migrations). Aplique as migrações na ordem em um projeto sob seu controle.

- Supabase Auth + **Row Level Security (RLS)**
- Storage privado para fotos de perfil, fundos e imagens de instituições

Antes de dados reais:

1. Configure autenticação e contas autorizadas  
2. Aplique e revise migrações em ambiente de teste  
3. Confirme políticas RLS e buckets  
4. Verifique redirect URLs  
5. Faça backup antes de alterar produção  

---

## Estrutura do repositório

```text
app/                    Páginas e rotas (agenda, captção, processos, API…)
components/             Elementos compartilhados
lib/                    Regras, integrações e validações
public/branding/        Logotipos INFINITUM, Lead Broker e assets de login
supabase/migrations/    Schema e políticas
tests/                  Testes automatizados
```

---

## Testes e publicação

```bash
npm test
npm run build
```

Deploy pela **Vercel** a partir deste repositório. Configure as variáveis de ambiente na plataforma e valide o resultado antes de considerar a mudança concluída.

---

## Critérios de operação

- Finalizado = encerramento operacional, **não** quitação financeira comprovada  
- Status importado de planilha não substitui comprovante  
- Ausência em DataJud/DJEN ≠ ausência real de movimentação  
- Atendimentos devem ser registrados com dados reais; o sistema não envia mensagens automaticamente  
- Dados parciais devem ser apresentados como tais  

Não inclua dados pessoais, planilhas reais ou credenciais em commits ou exemplos públicos.

---

## Licença e direitos autorais

**© 2026 W1 Capital.** Material novo sob [Licença Proprietária W1 Capital](./LICENSE); material distribuído anteriormente sob MIT preserva a respectiva autorização.

A marca **INFINITUM**, o símbolo infinito, o logotipo Lead Broker e demais elementos visuais de marca **não** são licenciados automaticamente pelos termos de código. Respeite os direitos de titularidade antes de reutilizar.

---

<div align="center">

<img src="./public/branding/infinitum-symbol-branco.svg" alt="INFINITUM" width="48" />

**INFINITUM** · W1 Capital

</div>
