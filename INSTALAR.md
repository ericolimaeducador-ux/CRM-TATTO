# Como instalar este banco de agentes

Para instalar o TattooArt no Windows e usar no computador e no celular, siga o [INSTALAR-WINDOWS.md](INSTALAR-WINDOWS.md). O restante deste arquivo é o banco de agentes do Cursor.

1. Descompacte o conteúdo na **raiz** do repositório do `captura7` (pode ser uma pasta vazia).
2. Abra a pasta no Cursor.
3. Confirme que o Cursor carregou as rules: `.cursor/rules/000-projeto.mdc` e
   `010-integridade.mdc` devem aparecer com `alwaysApply`.
4. Preencha o model ID em `.grok/config.md` com o que aparece no seletor de modelo.
5. No chat do Cursor, em modo **Agent**, cole o comando de abertura da Fase 0
   (ver seção abaixo).

## Comando de abertura da Fase 0

```
CENTRO DE COMANDOS: leia AGENTS.md, .cursor/rules/, .grok/BOARD.md e .grok/DECISOES.md.
Confirme em uma linha que absorveu a regra 010-integridade.
Depois abra a Fase 0 executando os cards F0-01 e F0-02, nesta ordem, acionando
@OPS-10 e @ARQ-02. Atualize o BOARD e o PROGRESS_FASE_0.md ao fim de cada card.
Pare antes do F0-03 e me mostre o resultado.
```

## Regra de uso diário

Fale sempre com o `CENTRO DE COMANDOS`. Se quiser um ajuste cirúrgico em algo já pronto,
aí sim chame o agente direto: `@ARQ-02: adicione índice X em Y`.
