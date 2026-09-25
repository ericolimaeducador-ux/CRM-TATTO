# Rotação do pepper

O pepper não está no repositório. Trocar `CIFRA_PEPPER` sem reprocessar invalida `cpfHash` e `cnpjHash` e, com eles, o índice de unicidade.

1. Gerar o pepper novo fora do repositório e guardar o antigo até o fim do reprocessamento.
2. Para cada contato com `cpfCifrado` ou `cnpjCifrado`, decifrar com a chave AES atual, recalcular o HMAC com o pepper novo e gravar o hash novo.
3. Não escrever o documento decifrado em log.
4. Conferir que o índice parcial único continua de pé.
5. Só então apagar o pepper antigo do ambiente e reiniciar a API.

A chave AES não muda neste procedimento. Rotação de chave é outro reprocessamento, com decifrar na chave velha e cifrar na nova, e não está automatizado.
