# Retenção e revogação

Isto repete o que já está em `.grok/SUPERCOMANDO.md` (seção 9.5) e na regra 010. Não acrescenta prazo, artigo ou exigência que não esteja lá.

- `lgpd.revogadoEm` bloqueia exportação na hora. A função `exportacaoBloqueada` é o predicado. A rota de exportação é da Fase 3.
- 30 dias depois da revogação, a rotina pode limpar `emails`, `telefones` e `enderecos`. Ficam `_id`, `codigo`, a trilha em `contatos_auditoria` e o próprio registro da revogação (`revogadoEm`). A rotina que executa a purga ainda não existe; o predicado `devePurgarContato` está testado.
- Rascunho sem alteração há 180 dias é só sinalizado (`deveSinalizarRascunho`). O expurgo, quando existir, tem que ser logado.
- O texto do termo de consentimento continua em aberto em `.grok/ESCALONAMENTOS.md`. Este diretório não o redige.
