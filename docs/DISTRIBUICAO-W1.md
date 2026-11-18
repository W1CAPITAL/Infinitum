# INFINITUM · distribuição e instalação

A distribuição de aplicativos Windows da W1 Capital é organizada pela [Central de Apps](https://github.com/W1CAPITAL/Central-de-Apps).

## Obter o aplicativo

1. Acesse [Releases da Central de Apps](https://github.com/W1CAPITAL/Central-de-Apps/releases).
2. Consulte os arquivos efetivamente publicados e seus respectivos hashes.
3. Para a prévia `v0.1.48`, o instalador da Central está [disponível aqui](https://github.com/W1CAPITAL/Central-de-Apps/releases/download/preview-v0.1.48/W1-Central-de-Apps-Setup-0.1.48-x64.exe).
4. Confira a [documentação do aplicativo desktop](../desktop/README.md) antes de configurar integrações.

A Central contém o INFINITUM em seu catálogo. O instalador individual mais recente verificado está como [artefato Windows da execução GitHub Actions #44302707806](https://github.com/W1CAPITAL/Infinitum/actions/runs/44302707806) — baixe o ZIP `infinitum-killa-windows-test-UNSIGNED` na seção **Artifacts**. O instalador gerado corresponde à versão `0.1.2` do projeto desktop, é **não assinado**, e o artefato expira em **02/12/2026**. Ele não foi publicado como asset da pré-release da Central. Não utilize arquivos de terceiros como se fossem versões oficiais.

## Integridade e atualizações

A versão mencionada é uma **pré-release**, não uma versão estável assinada. Consulte a página da release para o status e os hashes. O canal de atualização automática exige as verificações de integridade e assinatura definidas pela Central.

## Desenvolvimento

Para rodar o código localmente e construir o aplicativo, consulte [o manual do desktop](../desktop/README.md) e [o guia de implantação](SELF-HOSTING.md). A distribuição desktop não dispensa a infraestrutura autenticada de dados e demais serviços externos.
