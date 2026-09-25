# Configuração de Modelo

| Campo | Valor |
|---|---|
| Provedor | xAI (Grok) via Cursor |
| Model ID em uso | `<preencher com o que aparece no seletor do Cursor>` |
| Data de configuração | <preencher> |
| Última troca | — |

## Regra

O model ID vive **somente aqui**. Nenhum arquivo em `.grok/agents/`, nenhuma rule
em `.cursor/rules/` e nenhum comentário de código pode citar um modelo pelo nome.
Isso mantém todo o banco de agentes portátil entre gerações de modelo.

## Como trocar

```
CENTRO DE COMANDOS: atualize .grok/config.md para o model ID <NOVO_ID>, registre a
troca como ADR em .grok/DECISOES.md com data e motivo, e confirme por varredura que
nenhum arquivo do repositório menciona um modelo específico pelo nome.
```

## Nota operacional

Não importa qual geração do Grok está no seletor. Os agentes são escritos para
funcionar com qualquer modelo de capacidade razoável de código. Se o modelo em uso
tiver janela de contexto curta, o ORQ-01 deve quebrar tarefas em cards menores no
BOARD — nunca relaxar as regras de `010-integridade.mdc` para "caber".

## Sintomas de degradação (quando reduzir escopo do card)

- O agente começa a reescrever arquivos fora do seu `arquivos_que_possui`
- O agente "esquece" de atualizar o BOARD
- O agente produz código que ignora `contatos_auditoria`

Qualquer um dos três: pare, reduza o card, reabra.
