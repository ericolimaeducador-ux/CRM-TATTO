# Progresso — ciclo do termo (depois da parada 4)

Autorização escrita do dono (Professor Erico), 2026-09-26: "Autorizo implementar as mudanças do termo no captura7."

Este ciclo não reabre as fases 0 a 3 e não faz merge. A base é `cursor/fase-3-captura7`.

A minuta v2 está em `docs/lgpd/TERMO_CONSENTIMENTO_CAPTURA7_minuta_v2.md`, copiada sem preencher `[A PREENCHER]`. Não está liberada para uso externo: falta revisão de advogado humano e validação de UX.

## Despacho CC-00 — 2026-09-26

Pedido recebido: implementar o termo de consentimento com as decisões D3, D4, D6 e D10, sem decidir o que continua aberto.
Interpretação adotada: o rascunho salva com consentimento pendente (ADR-008); contato comercial, ERP e exportação bloqueiam até o registro daquela finalidade; a conclusão do autocadastro exige a caixa.

Cards criados:
| ID | Título | Agente | Aceite | Dep |
|---|---|---|---|---|
| T-00 | Autorização, ADR-008 e minuta | CC-00 | autorização no board e minuta com colchetes | [] |
| T-01 | Schema e trilha pseudonimizada | ARQ-02 | nome não entra em claro na trilha | T-00 |
| T-02 | Registro, revogação, eliminação, autocadastro | SEC-07 | sem caixa não conclui; eliminação não reescreve a trilha | T-01 |
| T-03 | QSA, planilha pendente, webhook | INT-06 | sócio não persiste; sem envio_erp não há POST | T-02 |
| T-04 | Telas da mesma autorização | UI-04 | pendente visível; botão nasce desabilitado | T-02 |
| T-05 | Bateria | QA-09 | lint, build, Jest, Vitest, Playwright, segredos | T-03, T-04 |
| T-06 | Portão | REV-11 | veredito neste arquivo | T-05 |

Cards bloqueados por escalonamento: F3-02 (D8). D1, D2, D5, D7, D9, D11, D12 e os colchetes sem número seguem abertos e não foram preenchidos.
Despachado para: ORQ-01
