# Killa AI MCP — integração externa sem Work

## Endpoint principal independente da Vercel

`https://ulkuhiibeoibbzhqrfya.supabase.co/functions/v1/killa-mcp`

Implantação própria **Supabase Edge Function** com OAuth Supabase, autenticação MFA/AAL2, client IDs aprovados, leitura restrita por usuário e RLS. Não depende de publicar alterações no frontend Vercel. **OAuth Server precisa estar habilitado** no projeto Supabase para login de clientes externos. ChatGPT/Claude/Grok/OpenCode/FreeBuff só podem conectar se sua versão/plano suportar servidor MCP remoto e o fluxo OAuth.

As ferramentas do Edge incluem status, histórico privado, estado do WhatsApp, pareamento por **imagem QR** ou **código por telefone**, solicitação de envio, acompanhamento do recibo e KPI de envios aceitos. O QR/código só pode ser mostrado ao assistente quando `mcp_pairing_enabled` está habilitado pelo administrador; isso é sensível e deve ficar desativado quando não estiver em uso.

**Envio seguro:** `killa_request_send` cria uma solicitação de mensagem para conversa privada já arquivada. Um funcionário entra no INFINITUM com seu login normal, segundo fator e abre a página `/mcp/approve?requestId=...` para conferir e confirmar. A Edge Function executa o envio uma vez; resposta sem recibo fica `uncertain` e não será automaticamente reenviada. O navegador de aprovação ainda precisa de uma versão do frontend que contenha essa página. `killa_send_status` consulta o estado; `killa_attendance_kpi` conta somente aceite com ID do provedor.

**NÃO coloque senhas, tokens Supabase, QR ou código de pareamento em mensagens de chat.** A imagem temporária só deve ser exibida em ferramentas seguras, quando explicitamente habilitada.

---


Esta documentação explica o servidor MCP remoto de **leitura e rascunhos** do INFINITUM. Ele reaproveita a autenticação Supabase, os motores determinísticos, o PredictLM e a pesquisa DJEN/DataJud já existente. **O MCP não envia mensagens WhatsApp.** Para mensagens ao cliente, o operador precisa abrir o INFINITUM e confirmar cada envio individualmente.

## Endereço legado do frontend (opcional)

`https://agentinfinitum.vercel.app/mcp` — transporte MCP Streamable HTTP, sem sessão do servidor, métodos `initialize`, `tools/list`, `tools/call`, `ping`. O servidor não usa Colibri API, Needle ou um serviço separado de inferência.

Não use este endereço até confirmar um deploy de produção `READY` que contenha a PR de Killa AI. O projeto não instala automaticamente conectores em contas ChatGPT, Claude ou Grok.

## Ativação (administrador)

1. Ative **Supabase Auth → OAuth Server**, com registro dinâmico de clientes e consentimento habilitados. Configure **Authorization Path** como `/oauth/consent`, e confirme o **Site URL** como `https://agentinfinitum.vercel.app`. Mantenha redirecionamentos de login restritos aos domínios reais.
2. No **INFINITUM nativo**, acesse `/mcp/setup`, habilite o MCP e salve. É necessário um login administrador do CRM. O nível **Médio** libera a leitura de histórico; a pesquisa por processo no banco nativo ainda exige vínculo WhatsApp–processo comprovado e, até sua implantação, permanece bloqueada. Se o login usa a **carteira LexisPredict compartilhada**, configure o MCP nas regras da empresa. As opções começam desligadas. Grupos têm uma permissão separada, também desligada.
3. Em cada cliente MCP, informe o endereço acima, complete o OAuth com sua conta no INFINITUM e aprove somente clientes reconhecidos. Cada conta consulta apenas seus dados permitidos pelas regras e RLS.
4. Verifique o resultado com `killa_status`, `killa_list_chats`, `killa_read_chat` e `killa_preview_reply`. Nenhuma ferramenta faz disparos. Não compartilhe access tokens em conversas ou códigos-fonte.

### Claude

Em **Customize → Connectors → Add custom connector**, configure o URL MCP e login OAuth. É necessária disponibilidade de conectores personalizados no seu plano e na interface.

### Grok / Grok Build

No cliente que aceite MCP remoto use `grok mcp add --transport http killa-ai https://agentinfinitum.vercel.app/mcp` e depois `grok mcp doctor killa-ai`. O Grok da API tem uma configuração de MCP diferente, conforme o SDK.

### OpenCode

Exemplo `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "killa-ai": {
      "type": "remote",
      "url": "https://agentinfinitum.vercel.app/mcp",
      "enabled": true,
      "oauth": {}
    }
  }
}
```

Faça o login OAuth seguindo o fluxo apresentado pelo OpenCode. Não use credenciais Supabase privadas em `headers`.

### FreeBuff

Use a configuração de servidor MCP remoto HTTP da versão instalada para registrar `https://agentinfinitum.vercel.app/mcp`, com OAuth por usuário. A compatibilidade de autenticação precisa ser testada com a versão específica do FreeBuff.

### ChatGPT

No **ChatGPT web → Plugins → Add custom MCP server**, se essa função estiver disponível no plano e nas permissões de sua conta, adicione o endereço remoto e conclua o OAuth. O plano Plus não deve ser presumido como elegível para todos os recursos de MCP personalizado; o produto pode impedir a conexão ou restringir ferramentas. **Work não é requisito da arquitetura MCP**, mas o produto ChatGPT pode exigir permissões/planos específicos.

## Níveis e limites

- `básico`: dados da empresa no status; não concede histórico por MCP.
- `médio`: permite listar/ler conversas do proprietário autenticado.
- `alto`: permite solicitar pesquisa oficial vinculada a contato privado autorizado **na carteira LexisPredict compartilhada**. No banco nativo, essa ação permanece bloqueada até existir autorização explícita do vínculo entre contato e processo.
- `muito alto` e `máximo`: ampliam o fluxo de propostas no INFINITUM, mas **não** concedem envio automático pelo MCP.
- O MCP não contorna controles de outro atendente, limites de envio, escopos Supabase ou revisão jurídica.
- Grupos permanecem bloqueados até habilitação específica. **Nunca envie backlogs, logs, prompts ou dados administrativos para clientes.**

## Motores locais

O workbench permite Qwen2.5 0.5B, Qwen3 1.7B e Qwen3 4B (ONNX via Transformers.js). Modelos maiores exigem mais memória; o de 4B necessita WebGPU habilitada. O executável usa Web Worker e o cache local existente, sem API externa de inferência. Download dos pesos pode ser demorado, e desempenho real depende do dispositivo. A verificação determinística de fatos prevalece sobre a sugestão de qualquer modelo.

## Segurança e publicação

Mantenha OAuth Server, RLS, whitelists de redirect, CSP e supervisão de logs sob revisão. A rota de mensagens exige sessão autenticada; não configure token global de serviço no navegador. No banco nativo, habilite a integração pelo endereço `https://agentinfinitum.vercel.app/mcp/setup` após a publicação. A CI testa `npm test`, `npm run typecheck`, `npm run test:dom`, `npm run build`. Só considere o MCP **operacional** após deploy `READY`, autorização OAuth ativada e uma conexão real bem-sucedida com cada cliente. Se a Vercel bloquear builds por limite do plano, o código pode estar na `main` sem estar no domínio principal.


## Regras de segurança reforçadas (16/11/2026)

O MCP aceita somente tokens OAuth identificados pelo `client_id` do aplicativo cadastrado no Supabase, associado à mesma conta e aprovado explicitamente em `/mcp/setup`. A tela de consentimento exige sessão interativa `aal2` e grava uma prova privada de MFA vinculada ao usuário, empresa e cliente OAuth. **O token OAuth emitido pelo Supabase pode ser `aal1` mesmo quando a sessão do navegador passou por MFA**; por isso o MCP não confia no `aal` do token OAuth isoladamente. A prova de MFA expira em 8 horas e é verificada no servidor por RPC, mantendo a exigência de segundo fator sem criar um ciclo de login. O endpoint público não atende `initialize` nem `tools/list` sem autenticação válida.

**Separação real de privilégios:** as demais rotas do CRM recusam JWT OAuth de terceiros, mesmo quando válidos. A migração `20261116143000_killa_oauth_database_boundary.sql` cria políticas `AS RESTRICTIVE` de INSERT, UPDATE e DELETE nas tabelas públicas existentes com RLS. As permissões anônimas de escrita e TRUNCATE herdadas são revogadas. Novas tabelas requerem migração equivalente antes de exposição.

**QR individual:** a ferramenta `killa_whatsapp_status` informa o estado da conexão e mostra o link `https://agentinfinitum.vercel.app/mcp/pair`. O QR é apresentado e renovado no navegador autenticado do operador, nunca devolvido nos resultados do modelo. Use seu WhatsApp no celular para escanear o QR; não envie imagens do QR à IA.

**KPI:** a rota `/api/office/agent/kpis` contabiliza apenas eventos OpenBot com `status='accepted'` e `provider_message_id`, agrupados pelo operador autenticado, em janela de 30 dias. Sem a tabela de confirmações na carteira nativa, a resposta é **fonte indisponível**. Preparações MCP não são atendimentos.

**Limites:** ferramentas MCP continuam sem envio; a capacidade de um modelo gerar uma mensagem não confere permissão para dispará-la. A senha é inserida no login HTTPS do provedor de identidade, não no ChatGPT/Claude/Grok. Nenhuma obfuscação impede engenharia reversa de JS exposto; controle real se aplica no servidor e no banco.
