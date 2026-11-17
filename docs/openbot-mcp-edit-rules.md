# Regras do MCP — OpenMausBot ↔ INFINITUM CRM

O MCP foi desenvolvido para conectar um OpenMausBot externo ao CRM **sem entregar o banco, senhas ou poderes irrestritos ao agente**.

## Permissões

- **Somente leitura (padrão):** pesquisar processos e clientes, consultar as conexões aprovadas e listar metadados permitidos de Drive, Sheets, Gmail e contas profissionais do Instagram. O agente não envia mensagens.
- **Edição supervisionada (opt-in):** o titular ativa essa permissão, por cliente OAuth identificado, após MFA. O agente pode usar \`crm_propose_edit\` para solicitar alterações, mas não as aplica.
- **Aprovação:** o operador abre OpenBot → Aplicativos → MCP → Edições propostas, confere registro, campo, novo valor, justificativa e prazo. A primeira seleção solicita confirmação; a segunda confirma a aprovação. O segundo fator **AAL2 é exigido no servidor e no banco**.
- **Revogação:** o titular pode revogar um cliente OAuth a qualquer momento; a aprovação de mudanças exige que a permissão de edição ainda esteja ativa. Grants expiram em 30 dias.
- **Prazo:** cada proposta expira em 30 minutos. Se o registro mudou desde a consulta do agente, a edição falha por conflito e é necessário consultar novamente.

## Campos permitidos inicialmente

| Tipo de registro | Campos alteráveis |
| --- | --- |
| Cliente interno (\`office_clients\`) | notas, próximo retorno, responsável |
| Processo interno (\`office_cases\`) | observações, próxima revisão |
| Atividade (\`office_deadlines\`) | notas, responsável, prioridade |
| Cliente consolidado (\`crm_clients\`) | notas, próximo retorno, responsável, prioridade |

**Nunca por este MCP:** excluir dados, mudar número do processo, substituir identidade ou documento do cliente, alterar decisão judicial, fase processual oficial, valor financeiro, data de prazo legal, enviar mensagens de WhatsApp/Gmail, publicar no Instagram, instalar programas, executar comandos, mudar permissões ou mexer em credenciais.

## Escopo e responsabilidade

- O MCP só acessa dados visíveis para o usuário Supabase autenticado; para os registros internos, exige titularidade do registro e associação à mesma empresa.
- Para \`crm_clients\`, exige empresa vinculada à conta.
- Clientes OAuth não têm UPDATE/DELETE sobre a fila de propostas nem podem chamar a função de aprovação com seu token.
- A função de aprovação exige sessão humana sem \`client_id\` OAuth, confirma AAL2, empresa, proprietário quando aplicável, escopo de edição ainda ativo, campo permitido e versão atual.
- O registro guarda autor externo, motivo, valor anterior/novo, aprovador, data/hora, status e ID de aprovação. A aprovação e a edição ocorrem na mesma transação no banco.

## Ferramentas MCP

- \`crm_search_clients\` / \`crm_search_processes\`: leitura de dados autorizados.
- \`openbot_connections_status\`: lista contas conectadas sem tokens.
- \`openbot_drive_list\`, \`openbot_sheets_list\`, \`openbot_gmail_list\`, \`openbot_instagram_list\`: leitura limitada à conta OAuth autorizada.
- \`crm_propose_edit\`: cria proposta auditável; **não altera o registro**.
- \`crm_pending_edits\`: lê o estado da fila.
- **Aplicação:** ocorre exclusivamente em \`openbot_review_mcp_edit\`, invocada pela interface autenticada do OpenBot com MFA.

## Limites atuais

Esta é uma integração MCP de **consulta e edição supervisionada de CRM**, não acesso ao sistema operacional, controles internos de todos os módulos do OpenMausBot nem administração irrestrita. O MCP exige que o Supabase OAuth Server e o cliente externo estejam realmente habilitados. Ativar um botão de escopo não comprova pareamento, e o sucesso de um build não comprova uma chamada real autenticada.
