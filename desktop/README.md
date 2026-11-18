# INFINITUM / Killa AI — Windows Desktop

> **Distribuição:** [Central de Aplicativos W1 Capital](https://github.com/W1CAPITAL/Central-de-Apps) · [Releases Windows](https://github.com/W1CAPITAL/Central-de-Apps/releases) · [Guia específico do INFINITUM](../docs/DISTRIBUICAO-W1.md). Na prévia `v0.1.48`, o INFINITUM está no catálogo, mas não há instalador individual publicado como asset da Central. Os builds próprios podem ser consultados nos workflows deste repositório.



## Linguagens, versões e estrutura do código

| Tecnologia | Uso neste aplicativo |
| --- | --- |
| JavaScript ESM (`.mjs`) | Processo principal Electron, políticas, scripts de build e atualização |
| JavaScript CommonJS (`.cjs`) | Preload seguro do Electron |
| HTML5 / CSS3 / JavaScript | Launcher local do aplicativo |
| JSX / React | Interface INFINITUM servida pelo Next.js standalone |
| SQL / PostgreSQL | Banco Supabase, migrações e políticas de acesso |
| YAML / JSON | GitHub Actions e configurações do build |
| PowerShell | Verificação da assinatura Windows |
| TypeScript 5.9.3 | Verificador estático; a configuração atual checa arquivos JavaScript com `allowJs` e `checkJs` |

**Versões verificadas:** Next.js 15.5.29, React 19.1.2, Node.js 24 no workflow Windows, Electron 45.3.2, electron-builder 26.18.0 e electron-updater 6.8.11. O pacote raiz declara Node.js >=22.

Arquivos importantes: `main.mjs` (processo principal), `preload.cjs` (ponte restrita), `runtime-policy.mjs` (políticas de navegação/configuração), `launcher.html` / `launcher.css` / `launcher-ui.js` (launcher), `stage-standalone.mjs` (staging), `verify-packaged-server.mjs` (smoke test do payload empacotado) e `package.json` (Electron Builder/NSIS).

Consulte também [documentação geral de arquitetura e linguagens](../docs/TECH-STACK.md).

## Estado da integração WhatsApp

O desktop ainda fornece `WA_AUTO_URL` apontando para o bridge WA.Auto em `runtime-policy.mjs`. O domínio ZapFast permitido na política de navegação abre o site externo no navegador padrão; **isso não conecta automaticamente o ZapFast à caixa de entrada `/whatsapp` do INFINITUM**. A integração multiempresa, com sessão isolada por empresa e histórico no Supabase, não deve ser anunciada como concluída até ser implementada e testada de ponta a ponta.

## O que este instalador faz

- Executa a aplicação INFINITUM **integralmente de um servidor Next.js standalone local** dentro de um processo Node embutido no Electron, em \`127.0.0.1\` com porta persistente por perfil Windows. **Não abre o site Vercel** nem exige Node.js instalado no PC.
- Cada funcionário entra na própria conta Supabase, com sessão no perfil do Windows; RLS e permissões da empresa continuam no servidor.
- Supabase Realtime assina mudanças de mensagens e sessões por \`owner_id\`; dados privados nunca são transmitidos em eventos globais.
- OpenBot, motores PredictLM, Qwen local e QR do WA.Auto usam a interface existente do INFINITUM.
- O MCP permanece na Edge Function \`https://ulkuhiibeoibbzhqrfya.supabase.co/functions/v1/killa-mcp\` e não depende do executável nem da Vercel.
- A configuração pública vem por HTTPS de \`/functions/v1/killa-mcp/desktop-config\`. **O EXE não contém chave service_role, sb_secret, JWT privado ou senha do usuário.**
- O WA.Auto continua hospedado no serviço HTTPS existente. **Sem internet/Supabase ou WA.Auto, sincronização, login e QR não funcionam**; este é um cliente local, não um WhatsApp offline.

## Gerar instalador Windows

No GitHub, execute o workflow \`INFINITUM Killa AI — instalador Windows\`. Ele prepara o Next.js standalone e gera \`INFINITUM-KillaAI-Setup-0.1.1-x64.exe\` como artefato GitHub Actions. O usuário que instalar **não precisa do Vercel nem do Node**.

Localmente, com Node.js 24 e Windows:

\`\`\`powershell
npm install
$env:KILLA_DESKTOP_STANDALONE="1"
npm run build
node desktop/stage-standalone.mjs
npm install --prefix desktop
npm --prefix desktop run pack:win
node desktop/verify-packaged-server.mjs
npm --prefix desktop run dist:win
\`\`\`

O instalador do workflow de teste Windows (artefato `infinitum-killa-windows-test-UNSIGNED`) **não é uma distribuição final**. Pode apresentar avisos do SmartScreen e não deve ser oferecido como versão sem alertas. As **releases públicas do GitHub** agora exigem tanto assinatura Windows Authenticode válida para o EXE e instalador quanto validação da cadeia de confiança em Windows antes da publicação. A assinatura gratuita Ed25519 continua protegendo o manifesto de atualização do launcher, mas não substitui Authenticode. Mesmo arquivos Authenticode válidos podem mostrar avisos inicialmente até que o editor ou hash tenha reputação positiva. Para eliminar especificamente o aviso de download SmartScreen de forma mais previsível, considerar distribuição pela Microsoft Store.

## Verificação do instalador Windows

O smoke test do Next antes do empacotamento não detectava a perda de dependências ao gerar o pacote Electron. O instalador 0.1.1 inclui explicitamente o node_modules do Next standalone como recurso separado. Os workflows agora executam o EXE de verdade em modo Node em 127.0.0.1 e exigem a resposta autenticada do healthcheck antes de liberar o instalador. Se faltarem arquivos, o workflow falha e não publica o pacote.

O instalador 0.1.0 antigo não deve ser usado para validar o conserto; ele precisa ser substituído pelo 0.1.1 gerado após essas verificações.

## Segurança e limites

O navegador embarcado permite somente a origem local e abre links HTTPS permitidos no navegador padrão. Node.js está desativado na interface, com sandbox e isolamento de contexto. O processo Next local recebe apenas \`NEXT_PUBLIC_SUPABASE_URL\`, chave pública Supabase e URL pública WA.Auto; não herda chaves de serviço da máquina.

Uma chave Supabase publishable/anon é pública por definição e ainda pode ser vista por quem inspeciona o cliente, inclusive EXE. **Não pode ser escondida como segredo.** Segurança real: autenticação individual, RLS, OAuth, segundo fator e backend privado. Rotas Next que antes dependiam de credenciais privadas da Vercel continuam exigindo migração para Supabase Edge ou outro backend protegido; não funcionam automaticamente só por empacotar o código.

**Licença:** consulte [licença proprietária](../LICENSE) para código novo e [NOTICE](../NOTICE.md) para concessões MIT anteriores. Bibliotecas Electron/Next possuem licenças próprias.

## Sincronização de mensagens (configurada no Supabase)

A publicação `supabase_realtime` contém apenas `office_wa_chat_archive`, `office_wa_message_archive` e `killa_mcp_send_intents`, com eventos de inclusão e atualização. Os filtros exigem `owner_id` igual ao usuário autenticado e o cliente não replica mensagens de outros escritórios.

O KPI separa aceites `OpenBot` e `MCP` pelo recibo único do WA.Auto. Nenhum atendimento é registrado apenas porque um rascunho foi gerado. As telas atualizam os dados com atraso curto para evitar travamentos em PCs fracos.

**Nota de implantação:** o QR verdadeiro só pode ser mostrado após login do usuário e resposta válida da sua sessão WA.Auto. Este manual não contém QR, token ou código de pareamento. O modelo MCP pode entregar a imagem temporária somente quando o administrador habilita a opção sensível. O servidor MCP permanece hospedado no Supabase, independente dos instaladores.

## Versionamento e continuidade

A versão desktop mantém uma **porta fixa por perfil Windows** e verifica um identificador temporário do servidor antes de abrir o login; isso conserva Supabase Auth e o cache Qwen entre reinicializações. O projeto já publica em Realtime as três tabelas restritas por `owner_id`; outros dados do CRM seguem seus fluxos autenticados existentes e não são enviados globalmente.

O instalador piloto não recebe atualizações de código automaticamente sem assinatura Authenticode verificada. Um build Windows assinado poderá publicar novas versões com atualização segura quando certificados e canal de releases estiverem configurados. O modelo local Qwen funciona sem servidor de inferência, mas seus arquivos requerem download inicial e memória compatível.

## Publicação de atualizações para todas as instalações

O workflow [release Windows assinado](../.github/workflows/killa-desktop-signed-release.yml) foi preparado para distribuir novas versões pelo GitHub Releases, que o `electron-updater` verifica nas instalações existentes. Por segurança, ele **recusa publicar sem** os segredos `KILLA_WINDOWS_CERT_P12` e `KILLA_WINDOWS_CERT_PASSWORD`. O certificado nunca entra nos executáveis nem nos repositórios.

Somente builds assinados receberão `signed-updates.json: enabled=true`; os pilotos não assinados continuam sem download automático de código. As alterações de dados de cada usuário no Supabase Realtime não exigem novo executável.

## Launcher de atualização — estilo loja de aplicativos

A instalação inclui um **Killa Launcher** local, que abre antes do CRM e apresenta o produto, a versão instalada, o estado do canal e o andamento do download. A janela é HTML/CSS/JavaScript incorporada ao instalador e nunca carrega código remoto. Cada instalação utiliza `electron-updater` para buscar `latest.yml` e o instalador nas **GitHub Releases oficiais**; nenhum build, API ou arquivo da Vercel participa das atualizações.

No canal **assinado**, o launcher baixa novas versões em segundo plano, verifica o hash do pacote e exige assinatura Windows Authenticode com a identidade do publicador prevista no manifesto instalado. **Só executa o novo instalador com a confirmação explícita de quem está no PC**. Versões anteriores não são instaladas automaticamente. Quando a rede falha, é possível abrir a versão local já instalada.

No **piloto não assinado**, o launcher aparece e permite abrir o CRM, mas mantém o atualizador de executáveis bloqueado; não existe botão de instalar arquivo não verificado. A proteção não depende de ocultar JavaScript no navegador.

O workflow de publicação só aceita execução pela `main`, com certificado Windows obrigatório, `forceCodeSigning` e conferência final de `Get-AuthenticodeSignature` para o app e instalador. Se não houver certificado confiável, **nenhuma release será publicada**. O ambiente GitHub **desktop-production** deve ser configurado com revisores obrigatórios e acesso aos segredos `KILLA_WINDOWS_CERT_P12` e `KILLA_WINDOWS_CERT_PASSWORD`. Sem certificado ou aprovação, não há publicação de release. As permissões de escrever no GitHub ficam somente no workflow de release, não no EXE.

Para instalar em outro computador: baixe uma versão **assinada** em GitHub Releases e execute o instalador. Depois disso, o launcher baixa as versões futuras assinadas e oferece a instalação sem usar a Vercel. O Windows pode exigir consentimento UAC conforme a forma de instalação e a política do PC.

Atualizações dos **dados e regras armazenados no Supabase** continuam em tempo real, por usuário, independentemente de o executável ter uma nova versão. Mudanças de código do CRM e do OpenBot precisam de um novo pacote assinado; não são importadas automaticamente do banco para dentro do EXE.

## Loja de aplicativos W1 Capital e atualização gratuita

O Killa Launcher usa **logotipo W1 Capital vinho/prata** retirado do site oficial da W1 e **símbolo do infinito do INFINITUM**, separado do Ethereum. O arquivo .ico do EXE é gerado localmente pelo script generate-windows-icon.mjs, sem imagens de terceiros.

**Distribuição automática gratuita para usuários (com assinatura Authenticode exigida do editor):** somente GitHub Releases aprovadas manualmente, com manifesto Ed25519 assinado pela W1 Capital e hash SHA-512 do instalador. O launcher guarda apenas a chave pública e verifica a assinatura, os bytes, a URL oficial, a versão superior e o tamanho máximo antes de instalar. Por padrão, ele baixa e aplica atualizações autenticadas quando o CRM não está aberto; o funcionário pode desligar a opção no launcher.

**Proibido:** executar arquivos ZIP da branch main como atualizações, aceitar redirecionamentos a servidores externos, executar scripts enviados por clientes/LLMs ou baixar código JS remoto para substituir o aplicativo.

### Primeira publicação oficial (ação única necessária)

1. Abra GitHub do INFINITUM → Settings → Environments e crie/proteja **desktop-production**, restringindo a main e exigindo aprovação de revisores confiáveis.
2. Dentro de **desktop-production → Environment secrets**, cadastre o segredo **KILLA_ED25519_PRIVATE_KEY_B64**, contendo em Base64 o conteúdo integral do PEM da chave privada W1. Nunca publique esse PEM no Git, no ChatGPT, no WhatsApp ou no EXE. O public key fingerprint já embutido no cliente é 64226fb4ce21332768a8779be5548acdddd4933f0be48cfc35751884ca481d3c.
3. Em GitHub → Actions → **W1 Capital — publicar atualização GRATUITA Ed25519**, selecione a main, digite uma nova versão (por exemplo 0.1.1), execute e aprove a publicação. O workflow recompila, testa, assina o manifesto e envia o EXE somente ao GitHub Releases.
4. Instale o primeiro EXE oficial uma vez. A partir dele, o launcher verifica novas releases, baixa e aplica automaticamente as que a W1 publicar/aprovar.

Sem o segredo configurado e sem primeira release, **nenhum auto-update é ativado**. EXEs piloto anteriores não possuem a chave pública embutida e precisam da primeira instalação oficial manual.

### Assinatura gratuita versus confiança do Windows

A assinatura Ed25519 autentica criptograficamente uma atualização para o launcher e é gratuita, mas não atribui automaticamente status de editor confiável no Windows. O Microsoft SmartScreen pode avisar ou bloquear um instalador sem Authenticode emitido por uma autoridade reconhecida. Essa assinatura de editor normalmente exige um certificado que não é gratuito; não instalamos certificados raiz próprios nem desativamos mecanismos de proteção do Windows. O pipeline Authenticode opcional continua separado e bloqueado até haver um certificado legítimo.

### Segurança operacional

Os segredos de assinatura só são lidos no GitHub Actions de publicação, nunca no aplicativo ou no Supabase. Uma atualização com assinatura incorreta, hash adulterado, origem imprevista ou versão inferior é recusada. A instalação ocorre no perfil do usuário com NSIS, sem scripts ocultos nem elevação de privilégios forçada. Se a chave privada for comprometida, suspenda imediatamente o canal e faça rotação controlada da confiança — nenhum mecanismo é invulnerável ao roubo da chave de publicação.

Dados de clientes, WhatsApp e autenticação não são hospedados pelo serviço de releases. O Supabase continua guardando dados sob RLS por usuário, e o launcher não depende da Vercel.


## Administração de builds e MCP

Abra **Killa Launcher → Administração · Build Logs / Typecheck / Env**. Só o superadmin com MFA pode consultar os dados privados. A Edge Function e o console Next local não dependem de Vercel. O MCP pode consultar as execuções e solicitar publicação, nunca aprovar diretamente.

[Guia de superadmin e autorização](../docs/killa-store-superadmin.md).


### Correção do 404 ao abrir o EXE

O login pertence à rota `/` do INFINITUM; `/login` não existe. Launcher e verificações compartilham `DESKTOP_ENTRY_PATH='/'`. O CI exige HTTP 200 e conteúdo HTML nas rotas `/`, `/whatsapp` e `/app-store/admin`, antes e depois do empacotamento Windows. Uma resposta verde de `/api/desktop/health` isoladamente não é suficiente.

### Avisos de antivírus e editor desconhecido

O artefato `infinitum-killa-windows-test-UNSIGNED` é somente de teste e não deve ser instalado como versão pública. Releases públicas exigem certificado Authenticode confiável, validação do EXE e do instalador e revisão no GitHub. Um alerta com nome de ameaça não pode ser presumido falso positivo só por ser Electron. Não desative o Microsoft Defender; verifique o nome da detecção e a origem do arquivo.


## Migração do endereço público e das releases

O bootstrap do executável consulta o endpoint público do Supabase `/functions/v1/killa-mcp/desktop-config`. O Supabase Edge pode retornar `remoteOrigin` quando o operador configurar `W1_CANONICAL_ORIGIN` para o domínio HTTPS próprio do INFINITUM. Sem essa configuração, o CRM local pode abrir, mas os recursos protegidos de retransmissão OpenBot/OAuth continuam indisponíveis (não há fallback para Vercel).

As releases confiáveis vêm exclusivamente de `W1CAPITAL/Infinitum` no GitHub. O verificador continua exigindo assinatura Ed25519 própria, hash SHA-512 e nome de pacote autorizado. Manifestos assinados da origem antiga são recusados após a migração, mesmo quando sua assinatura criptográfica é válida.

O aplicativo Electron empacota `desktop/public-origin.mjs`, utilizado no processo principal e também na política das rotas Next. Uma dependência JavaScript fora de `desktop/` não seria incluída automaticamente pelo electron-builder.


## Central de Aplicativos independente do CRM

O botão **Abrir Killa AI Store** no launcher agora abre uma segunda janela local, carregada de `desktop/store.html`. Ela não abre `/app-store` nem depende de login do CRM para consultar os aplicativos disponíveis no instalador. A loja contém o INFINITUM (embutido e instalável pelo próprio setup) e o LexisPredict (repositório disponível; EXE ainda não incluído). Os links externos são restritos, e a janela não pode navegar para sites arbitrários nem executar JavaScript remoto. O acesso administrativo do superadmin continua protegido por MFA na rota separada do CRM e não é desbloqueado pela loja local.
