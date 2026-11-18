# Recuperação de atendimento

A correção anterior `c1e35da` já estava na main e no banco principal: a chave única evita duplicar eventos e a função permanece `SECURITY INVOKER`. Esses controles foram preservados.

Dois erros foram reproduzidos com PostgreSQL/PGlite isolado, sem registros reais: reutilizar a chave com outra descrição/data/confirmação devolvia sucesso e descartava os novos dados; e uma repetição após outro atendimento devolvia datas atuais como se fossem o recibo original. Os dois testes falharam antes da correção.

A migração adiciona apenas um snapshot JSONB por tentativa nova. Mantém a reserva do evento antes da escrita e bloqueia a linha do processo durante a transação. Repetições precisam corresponder ao pedido original e retornam o recibo armazenado, sem atualizar novamente o processo. A auditoria não exige UPDATE nem novas permissões. Eventos legados não recebem snapshots fabricados: é necessário consultar o histórico.

A interface agora diz que o registro não foi confirmado quando há erro, preserva a chave e orienta a conferir o histórico. Não afirma que uma escrita certamente não aconteceu após perda da resposta.

Validação dirigida: quatro testes PostgreSQL passaram, inclusive RLS entre empresas e execução anônima negada; typecheck aprovado. A validação completa e a aplicação no banco são registradas na PR. Nenhum cliente real foi usado nos testes. O rollback pode restaurar o corpo anterior da função de cinco argumentos, mantendo a coluna aditiva e os eventos existentes; não requer apagar dados.
