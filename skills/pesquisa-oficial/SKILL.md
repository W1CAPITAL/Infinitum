---
name: pesquisa-oficial
description: Pesquisa judicial oficial e checagem de fontes para processos da carteira autorizada.
---
# Pesquisa oficial com princípios de Agent Reach
Referências: https://github.com/Panniantong/Agent-Reach e mecanismos existentes DJEN/DataJud do INFINITUM.

Agent Reach é ferramenta de leitura e pesquisa. Não executa envio WhatsApp nem substitui prova judicial.
Este aplicativo Vercel NÃO executa o CLI Python Agent Reach, nem ferramentas sociais que exijam cookies.

- Resolver número CNJ de processo previamente autorizado por usuário e empresa.
- Preferir consulta do tribunal competente, DataJud e DJEN, com data e fonte.
- Reutilizar cache, respeitar erros 401/403/423/429/500/503 e períodos de backoff.
- Falha de fonte significa consulta não confirmada, não inexistência de movimentação.
- Conservar diferenças entre decisão, petição, pedido, pagamento e saque.
- Retornar informação breve ou solicitar revisão humana; nunca inventar sentença.
