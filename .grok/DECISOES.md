# ADRs — captura7

Formato: contexto · decisão · alternativas consideradas · consequências · status.
Status: `proposto` | `aceito` | `substituído por ADR-NNN`.

---

## ADR-001 — Entrada permissiva, saída controlada

**Contexto.** O usuário determinou que o app "não pode ter travas". O usuário primário
é vendedor em campo: corredor de hospital, feira, visita. Campo obrigatório em captura
de campo mata a captura e empurra o vendedor de volta para papel e WhatsApp.
Ao mesmo tempo, dado de contato sem nenhuma disciplina vira base inutilizável em seis meses.

**Decisão.** Nenhuma trava na captura. Todo controle de qualidade é **assíncrono**
(enriquecimento, dedup, score de completude) ou fica no **último metro** (promoção
lead → cliente). O registro nasce `status: "rascunho"` com qualquer quantidade de campos.

**Alternativas consideradas.**
- *Formulário com campos mínimos obrigatórios:* rejeitada — é exatamente a trava que o usuário vetou.
- *Zero controle em qualquer ponto:* rejeitada — sem gate de promoção não há como garantir
  integridade do cadastro que alimenta faturamento e entrega.

**Consequências.** Base de rascunhos vai conter lixo e duplicata por design. Isso é aceito e
tratado por DQ-08, não prevenido por bloqueio. Exige índice único **parcial** (só não-rascunho).

**Status.** aceito · 2026-09-25

---

## ADR-002 — captura7 nasce isolado do ERP, com saída preparada

**Contexto.** Em aberto se este cadastro alimenta o ERP da Sette (e portanto a cadeia
de rastreabilidade lote→cliente) ou se é ferramenta comercial autônoma.

**Decisão.** MVP **isolado**. Sem integração de escrita com o ERP. A saída é modelada
desde já como contrato estável — `POST /integracao/contatos-promovidos` com payload
versionado e assinatura HMAC — mas o consumidor não existe ainda.

**Alternativas consideradas.**
- *Integrar de saída no MVP:* rejeitada — acopla dois sistemas antes de o primeiro existir.
- *Ignorar a saída:* rejeitada — adaptar depois custa mais que desenhar o contrato agora.

**Consequências.** Se e quando o cadastro passar a alimentar rastreabilidade regulatória,
o gate de promoção (F3-01) vira **obrigatório e estrito** — CNPJ validado contra Receita,
endereço de entrega confirmado — porque cliente incorreto quebra fechamento de recall.
Até lá o gate é de qualidade comercial, não regulatório.
**Reverter custa:** ativar F3-03 e endurecer as regras de F3-01. Barato.

**Status.** aceito · 2026-09-25 · reavaliar quando o ERP tiver módulo de clientes vivo

---

## ADR-003 — Google Forms por polling da Sheets API, não webhook

**Contexto.** Duas rotas: Apps Script disparando webhook em tempo real, ou leitura
periódica da planilha de respostas.

**Decisão.** **Polling** da Google Sheets API a cada 5 minutos, com marca d'água na
última linha processada e idempotência por hash da linha.

**Alternativas consideradas.**
- *Apps Script → webhook:* mais imediato, mas exige endpoint público, gestão de segredo
  HMAC e um script vivo fora do repositório — um ponto de falha que ninguém monitora.

**Consequências.** Atraso de até 5 minutos entre resposta e aparecimento no app. Aceitável:
lead de formulário não é operação de tempo real. Migrar para webhook depois é troca de
adaptador, o normalizador de payload é o mesmo.

**Status.** aceito · 2026-09-25

---

## ADR-004 — CPF e CNPJ criptografados em repouso, com índice sobre hash

**Contexto.** CPF é dado pessoal cuja exposição em dump de banco é incidente reportável.
Mas o campo precisa ser indexado para deduplicação e verificação de unicidade.

**Decisão.** Armazenar `pf.cpf` cifrado (AES-256-GCM, chave em env/secret, nunca no repo)
e manter `pf.cpfHash` (HMAC-SHA256 com pepper) como o campo **indexado**. Unicidade e
dedup operam sobre o hash. Mesma estratégia para `pj.cnpj`.

**Alternativas consideradas.**
- *Texto puro:* rejeitada — dump de banco vira vazamento de base de CPFs.
- *Somente hash, sem cifra:* rejeitada — o valor precisa ser exibido e exportado.

**Consequências.** Busca por CPF é exata, nunca parcial. Rotação de pepper exige
reprocessamento da coleção — documentar o procedimento antes de produção.

**Status.** proposto · confirmar com SEC-07 no card F0-03
