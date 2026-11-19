# Tela Viva — automação WhatsApp preparada e desligada

## Autorização e escopo — 18/11/2026

O usuário solicitou mensagem automática por WhatsApp para cada lead novo, com as dependências de background prontas e envio desligado. A API e o frontend continuam executando localmente; configurações Cloud Run e demais serviços serão fornecidas posteriormente, quando necessárias. A conexão de banco preexistente aponta para MongoDB Atlas, conforme a conferência efetiva descrita abaixo. A base CRM Tela Viva foi publicada em `ericolimaeducador-ux/CRM-TelaViva`, commit `bbfd14a`.

## WA-01 — implementação

Módulo NestJS independente com Cloud API oficial via fetch, fila Mongo persistente, um trabalho por lead, marco de instalação e janela de elegibilidade de 24 horas. A reconciliação cobre leads recebidos por cadastro manual, QR, sincronização offline e planilha; não dispara para contas ou participantes de treinamentos. Sem Redis ou dependência adicional. Captura permissiva preservada.

O worker exige autorização registrada, telefone válido, configuração completa e `WHATSAPP_ENVIO_ATIVO=true` imediatamente antes da saída. Revogação, eliminação, fusão e pedidos de parada impedem mensagens. A configuração Compose foi conferida: envio `false`, token e número não configurados.

Reservas atômicas, retentativas limitadas para rejeição HTTP 429, recibos assinados e estados monotônicos; timeouts, 5xx e perda de reserva ficam incertos sem reenvio automático. A fila guarda IDs/hashes/estados sem telefone em claro, corpo ou token. Endpoint de status restrito à gestão; webhook usa bytes originais e HMAC da Meta. O desligamento da API aguarda o ciclo corrente.

Contrato e futura ativação: `docs/WHATSAPP.md`; decisão: ADR-016. A versão Graph é configurável; template aprovado sem parâmetros, conta Meta e segredos reais serão fornecidos na ativação.

## Evidências

- API build e lint aprovados pelo executor WA-01.
- QA-09: `whatsapp.spec.ts` aprovado: 30/30 testes com Mongo temporário e transporte simulado (35,2 s). Inclui OFF/configuração incompleta sem HTTP, marco persistido, idempotência/reinício/concorrência, consentimento/telefone/revogação, janela/expiração, 429 limitado, falhas ambíguas sem reenvio, recibos monotônicos/antecipados, STOP, assinatura/raw body e RBAC. Nenhum envio real executado.
- API completa após a integração: **192/192 testes, 38 suítes**, 130,7 s, exit 0.
- E2E do CRM com módulo carregado e desligado: **10/10**, 26,4 s, exit 0. Preservados captura offline, carteira/propostas, QR/presença/relatórios, promoção e consentimento.
- Lint completo API/web e build de produção API/web: aprovados; PWA com 36 entradas de precache. Build de produção substitui o de E2E.
- REV-11 final aprovado para preparação desligada; API aplicada no Docker local.

Após o primeiro parecer, a ressalva `Retry-After` foi corrigida. O prazo do provedor, em segundos ou HTTP-date, nunca é antecipado pelo teto do backoff próprio. Se atingir a expiração do lead, o trabalho expira sem reagendamento. Repetição focal: **33/33 testes**, 68,1 s; inclui três cenários novos de espera superior a uma hora, data HTTP e prazo fora da janela. Build/lint API aprovados pelo executor. A bateria geral 192 e E2E 10 é anterior a esse ajuste isolado; não se alega execução única de 195 testes.

## Limites

Não há credenciais Meta, template aprovado nem webhook público nesta etapa. O worker requer API e Mongo ativos; a implantação futura em Cloud Run precisará de configuração de execução de background. Aceite pela Meta não garante entrega; resultados incertos exigem conferência operacional. Nenhuma mudança de consentimento histórico nem migração destrutiva de dados.

## OPS-10 — conferência efetiva da instalação

Imagem da API reconstruída e aplicada com frontend/proxy local. API e Mongo do Compose saudáveis, web em execução. Saúde da API: HTTP 200. `/v1/whatsapp/status` sem sessão: HTTP 403. Ambiente efetivo da API: envio `false`, token ausente e número Meta ausente.

**Correção da evidência de banco:** a consulta inicial ao Mongo do Compose mostrava 1 usuário e 0 contatos. A conexão efetivamente usada pela API, obtida do ambiente sem expor URI/credenciais, já apontava para **MongoDB Atlas**, banco `captura7`. Nessa conexão foram confirmados **2 usuários, 5 contatos, 0 registros comerciais, 1 marco de instalação, 0 trabalhos WhatsApp e 0 tentativas**. O marco foi registrado em `2026-11-18T20:38:08.750Z`; os contatos anteriores não são importados para a fila. A implantação não alterou a URI existente, não migrou bancos nem removeu volumes. A aplicação está local; o banco preexistente é externo. Essa distinção foi informada ao usuário.

Nenhuma chamada à Meta nem mensagem real foi executada. Publicação da implementação preparada no mesmo repositório GitHub autorizado.

## REV-11 — portão WA-03, 18/11/2026

**APROVADO COM RESSALVAS para instalação local com envio desativado.** Revisão do módulo, configuração, main, contrato, ADR-016 e testes não encontrou bloqueio para esse escopo. Flag diferente de `true` e configuração incompleta retornam antes do transporte externo. O baseline persistido e a janela de 24 horas evitam importação da base histórica. Chaves únicas e reserva condicional protegem duplicatas; perda de reserva e resultado ambíguo não provocam reenvio automático. Consentimento, telefone, revogação, eliminação, fusão e bloqueio do destinatário são conferidos no caminho de envio.

Webhook usa HMAC dos bytes originais, comparação de segredo em tempo constante e ID do número empresarial; POST responde 200. Recibos são persistidos, reconciliados quando antecipados e aplicados por nível sem regredir entrega/leitura. O endpoint de status exige gestor/admin e não expõe segredos ou dados de leads. A fila não guarda número em claro nem corpo das mensagens; os registros de parada usam HMAC.

Evidências de QA fornecidas pelo CC-00: focal WhatsApp 30/30, API completa 192/192 em 38 suítes, E2E 10/10 e lint/build API/web aprovados. REV-11 fez revisão estática; não repetiu baterias, não enviou mensagens nem alterou código de produção, Docker ou Git.

**Ressalvas para ativação futura:** exigir conta/número/template e segredos oficiais, endpoint HTTPS acessível à Meta e teste controlado de entrega real. A retentativa atual aceita `Retry-After` numérico e limita a espera a uma hora; antes do uso real, convém não antecipar uma espera maior solicitada pelo provedor e tratar eventual formato HTTP-date. Configuração de background do Cloud Run, operação em nuvem e monitoramento de casos incertos continuam fora da validação local. O portão permite ao CC-00 aplicar a imagem desativada, conferir saúde/flag/volumes e publicar o código no repositório autorizado.

## REV-11 — fechamento da ressalva Retry-After, 18/11/2026

**APROVADO para preparação e instalação local com envio OFF.** A revisão cirúrgica de `reagendar` confirmou que o prazo mínimo do provedor aceita segundos ou HTTP-date e prevalece sobre o teto do backoff próprio. Quando a próxima tentativa alcança a expiração do trabalho, o estado passa a `expirado` sem novo agendamento. A documentação está alinhada, e a ressalva de implementação do primeiro parecer está resolvida; o parecer anterior permanece como histórico.

Evidências deste ajuste: focal WhatsApp **33/33**, incluindo espera superior a uma hora, data HTTP e prazo fora da janela; build/lint da API aprovados conforme CC-00/executor. A regressão completa **192/192** e o E2E **10/10** são anteriores ao ajuste pontual, sem alegação de nova execução integral. REV-11 não encontrou novo impeditivo no trecho alterado, não repetiu testes e não executou Docker/Git.

Permanecem os limites operacionais já documentados: envio desativado, ausência de credenciais/template oficial e de webhook público, entrega real não exercitada e background/nuvem ainda sujeitos à configuração futura. O CC-00 pode concluir rebuild local OFF, conferência de saúde/volumes e publicação no GitHub autorizado.
