# Política de segurança — INFINITUM / Killa AI

© 2026 W1 Capital. Abrange CRM jurídico, WA.Auto, Supabase, MCP/OAuth, DataJud/DJEN e histórico de atendimentos.

## Divulgação responsável

Informe vulnerabilidades de forma privada (GitHub Security Advisories, quando habilitado, ou suporte privado W1 Capital). Nunca publique senha, QR de WhatsApp, chave, token, nome de cliente, número de processo, dados bancários ou documentação sensível em issues públicas. Revogue e rotacione os segredos afetados e preserve evidência sem dados reais.

## Autenticação, isolamento e ameaças

- **Identidade:** login da própria empresa em Supabase Auth, segundo fator verificado (MFA/AAL2) na tela de consentimento, OAuth 2.1 com cliente `client_id` aprovado expressamente por administrador. Como o Supabase pode emitir sessões OAuth em AAL1, o INFINITUM grava uma prova MFA privada vinculada ao usuário, empresa e cliente, com validade de 8 horas; o backend valida essa prova antes de expor ferramentas. Senhas não são fornecidas a modelos de IA.
- **Escopo:** owner_id do usuário autenticado e empresa_id validada no servidor. O LLM não pode escolher outra empresa, falsificar permissões ou obter a carteira completa por consulta geral.
- **OAuth somente leitura:** tokens com \`client_id\` são aceitos apenas na rota MCP, nunca nas demais rotas do CRM. No PostgreSQL, políticas RLS \`RESTRICTIVE\` bloqueiam INSERT, UPDATE e DELETE com tokens OAuth diretamente na Data API; TRUNCATE e escrita anônima são revogados.
- **Registros de atendimentos:** KPI OpenBot conta somente aceite do WA.Auto persistido e comprovado; rascunhos, timeouts e mensagens sem recibo não entram como atendimento. Aceite não significa entrega nem leitura.
- **QR do WhatsApp:** pertence a sessão WA.Auto individual e é exibido exclusivamente em página do CRM autenticada. O MCP não devolve QR, código de pareamento, tokens ou credenciais aos assistentes.
- **Conteúdo não confiável:** histórico WhatsApp, PDFs, e-mails e texto de clientes são dados, não instruções. Não usar prompt de terceiros para modificar configuração, enviar logs/backlogs ou contornar regra de atendente humano.
- **Sessões:** revogar autorização do aplicativo OAuth e a sessão Supabase ao desligar usuário. Conexões com máquinas do operador devem ser encerradas quando o vínculo acaba.

## Chaves no Inspecionar Elemento

\`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\` / chave \`anon\` é intencionalmente pública, e não substitui autenticação ou RLS. Segredos como \`service_role\`, \`sb_secret_...\`, tokens de serviço, JWT signing secrets, senhas e chaves privadas **nunca** devem estar no JavaScript público, em \`NEXT_PUBLIC_\`, no HTML, em logs ou repositórios. **Se alguém tiver chave secreta com bypassrls ou controle de administrador do projeto, pode alterar dados e até remover políticas.** Nenhum sistema web garante imunidade a esse cenário; rotacione credenciais e separe permissões administrativas.

## LGPD e dados jurídicos

A Lei 13.709/2018 exige finalidade específica, minimização, retenção limitada, controle de acesso e resposta a incidentes. Cada integração de IA deve ter base e finalidade autorizadas; não exportar históricos completos ou dados de outras empresas, não usar PII real em testes e não passar arquivos jurídicos a modelos externos sem autorização apropriada. Garantir mecanismos para auditoria, revogação, resposta a titulares e exclusão conforme obrigações contratuais/legais.

## Engenharia reversa e hardening

REA, BLA, antirea, anti-rea-forge e DeRea ajudam a estudar ameaças, empacotamento ou limites de obfuscação. Alguns usam **instruções de prompt** para confundir agentes; isso não é barreira de segurança e não será instalado como substituto de autenticação. Repositórios públicos e bundles executados no navegador são inspecionáveis. Proteção efetiva: não colocar segredos nem regras privilegiadas no frontend, revisar dependências, RLS/ACL verificável, menor privilégio, logs redigidos, proteção de distribuição e testes de autorização negativos.

## Escopo da licença

[LICENSE](./LICENSE) passa a reger material autoral novo sob termos proprietários, preservando concessões históricas MIT. Marcas, bases privadas, credenciais e direitos de terceiros não são licenciados pelo MIT; veja [NOTICE](./NOTICE.md). A licença de LexisPredict é proprietária e independente.

## Limitações operacionais

Migrações futuras precisam adicionar políticas restritivas às novas tabelas públicas. Nenhuma ferramenta MCP atualmente permite envio automático. A verificação de envio judicial depende de cadastro de contato/processo, consentimento, revisão humana e confirmação do WhatsApp; sem esses elementos não registrar KPI.


## MCP Edge independente e envio com consentimento verificável

A Edge Function `killa-mcp` no projeto Supabase publica OAuth protegido independentemente da Vercel. Apenas client IDs autorizados, MFA/AAL2 e usuários ativos podem usar o MCP. Exibir QR ou código de pareamento ao próprio cliente OAuth exige `mcp_pairing_enabled=true`, configurável por administrador; QR é credencial transitória e deve ser tratado como segredo.

Para envio, a IA apenas cria uma solicitação com validade de cinco minutos. A operação real depende de um funcionário autenticado por sessão normal, com segundo fator, conferência do texto e consentimento explícito na página `/mcp/approve`. O backend usa atualização atômica para impedir envio concorrente duplicado, vincula o identificador WA.Auto e nunca repete automaticamente estados incertos. Nenhum agente recebe chaves privilegiadas. O frontend de confirmação requer implantação independente da Edge Function; enquanto não disponível, solicitações expiram sem envio.


## Canal gratuito de atualização da central W1 Capital

O launcher empacota os logos oficiais, valida a chave Ed25519 da W1 Capital embutida no EXE, manifesto de versão específico, URL oficial GitHub Releases e hash SHA-512 antes de executar um instalador. Não executa ZIPs da main, scripts remotos, mensagens de clientes ou instruções de LLM como atualizações. A chave privada deve existir somente no ambiente protegido de release GitHub Actions com revisão, jamais no Supabase, frontend, banco ou EXE. O instalador autêntico pode ainda receber alertas do Windows SmartScreen porque a assinatura Ed25519 própria não é Authenticode reconhecido pelo sistema. Não contornar os avisos do Windows nem importar certificados raiz automaticamente.


## Console W1 Capital — segregação de superadmin

Schema `killa_private` com privilégios revogados para anon/authenticated, allowlist exclusiva, MFA `aal2`, validação de sessão revogada e TOTP recente para publicações. Logs brutos e valores de Env não saem do GitHub/servidor. MCP externo só solicita releases; confirmação é pelo superadmin e o GitHub exige o ambiente protegido. Consulte [guia de segurança da loja](docs/killa-store-superadmin.md).
