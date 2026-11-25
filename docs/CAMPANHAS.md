# Campanhas WhatsApp — Tela Viva

Gestor e administrador preparam campanhas para contatos históricos selecionados explicitamente. A captura de leads permanece permissiva; o módulo não cria consentimentos nem altera dados do contato para permitir um envio. E-mail em massa não faz parte deste módulo.

## Modos de envio (ADR-020)

Em "Como enviar", no rascunho:

- **Manual pelo WhatsApp Web** (padrão enquanto a API não é contratada): preparar não exige modelo da Meta. Depois de preparada, cada contato tem o botão **Enviar pelo WhatsApp**, que abre a conversa com o texto pronto (WhatsApp Web no computador, app no celular). **Nada é enviado sozinho**: você confere e clica enviar no WhatsApp. Entre um contato e outro há o intervalo da cadência (padrão 90s); reabrir o mesmo contato não espera. O estado fica "Aberto no WhatsApp" — o CRM não sabe se você clicou enviar. Respostas e pedidos de SAIR chegam no celular: registre a revogação no contato para ele sair das próximas campanhas.
- **API oficial da Meta**: o fluxo abaixo, com modelo aprovado e envio automático.

Campanhas criadas antes desta opção são do modo API. O servidor recusa iniciar campanhas manuais e o robô de envio as ignora.

## Preparar e revisar

1. Crie um rascunho, ajuste título, mensagem e cadência. Pode salvar sem credenciais, template ou público.
2. Busque contatos por nome, origem, tag e datas de criação (dias inclusivos de São Paulo). Selecione IDs individuais; nenhuma busca seleciona toda a base implicitamente. Limite: 2.000 por campanha.
3. Consulte a prévia. Consentimento comercial precisa estar concedido e conter concessão ativa com versão do termo e hash do texto; telefone deve ser E.164 e não bloqueado. Descartados, eliminados, fundidos e revogados são excluídos. Telefones repetidos contam uma vez na campanha.
4. Consulte a Meta e selecione template `APPROVED` da categoria `MARKETING`. Suporte inicial: somente um componente `BODY`, texto sem parâmetros, sem cabeçalho/botões. O corpo precisa corresponder exatamente à mensagem revisada, ignorando apenas quebra CRLF e espaços externos. Não existe envio de texto livre.
5. Preparar congela o rascunho e materializa a fila. A consulta do template exige configuração privada, mas a flag de envio pode continuar desligada. Uma preparação interrompida mostra `preparando` e permite tentar preparar novamente com a versão atual ou cancelar.
6. Iniciar/retomar requer configuração completa, flag própria ativada pelo responsável, template novamente aprovado e confirmação explícita. Esta implementação e seus testes não ativam envios reais.

## Configuração privada

`CAMPANHAS_WHATSAPP_ATIVO` nasce `false`, independente de `WHATSAPP_ENVIO_ATIVO` (boas-vindas). A consulta de templates usa `WHATSAPP_WABA_ID`, `WHATSAPP_API_VERSAO` e `WHATSAPP_ACCESS_TOKEN`. Saída também exige `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` e `WHATSAPP_VERIFY_TOKEN`; o webhook existente precisa de HTTPS público para recibos/respostas. Os valores ficam no ambiente privado do servidor, nunca no frontend, no Git ou em prints. O checklist retorna apenas os nomes das configurações ausentes.

Nenhum número, token ou template é fornecido automaticamente. Preencher configuração não substitui a validação da conta empresarial, política vigente da Meta, autorização dos destinatários ou revisão da mensagem.

## Cadência e integridade

Padrão: intervalo de 90 segundos (mínimo 60), lote de 20, pausa de 600 segundos, teto global de 50 tentativas por dia, dias úteis, 9h–12h e 14h–17h no fuso `America/Sao_Paulo`. O rascunho permite ajustar essas escolhas dentro dos limites do servidor. Não são limites oficiais nem garantia contra bloqueio.

A fila e o agendamento global são persistidos no Mongo; unicidade por campanha/telefone hash. Reserva global atômica, renovação durante transporte e timeout de 10 segundos evitam POST concorrente entre workers de campanhas. A cadência é revalidada após consultar o template, antes de cada saída. Contabilização de tentativas é conservadora, incluindo requisições rejeitadas ou ambíguas. Trocar de campanha não zera intervalo, lote ou teto diário. As boas-vindas mantêm sua fila e comportamento anteriores.

Consentimento, telefone original e bloqueios são reconsultados antes de cada envio. Telefone alterado é excluído, sem redirecionar a mensagem para outro número. Resposta recebida após início da campanha interrompe saída ainda pendente; o resultado informa horário da resposta separado de entrega, sem guardar conversa.

429 respeita `Retry-After` e recuo progressivo, até cinco tentativas. Falha de rede, timeout, HTTP408/5xx, resposta sem ID ou reserva abandonada ficam `incerto`, sem reenvio automático. Pausar/cancelar impede novas saídas; requisição já em andamento pode terminar. Reiniciar ou retomar não recria destinatários aceitos. Aceito pela API não significa entregue; recibos assinados compartilhados atualizam enviado/entregue/lido. `Incerto` exige conferência na Meta antes de qualquer nova ação comercial.

Campanhas guardam autor/horário/versão e eventos append-only nas mutações; versões desatualizadas retornam409. Leituras pessoais de candidatos, prévia e resultados geram registro em `acessos_dados`, sem texto pesquisado ou telefone em claro. Trabalhos contêm somente ID do contato e hash/máscara do telefone; número é resolvido em memória na saída. Novas coleções são aditivas, sem migração destrutiva.

## API

Todas as rotas `/v1/campanhas` exigem sessão gestor/admin. Configuração, criação, leitura, edição e ações retornam `{registro}`; listas/templates/candidatos retornam `{registros,...}`. Ações e edição exigem `versao`; início e retomada também `confirmar:true`.

| Rota                                                      | Efeito                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| `GET /configuracao`                                       | Checklist sem credenciais                                         |
| `GET /templates`                                          | Templates aprovados simples consultados na WABA                   |
| `GET /candidatos`                                         | `q`, `origem`, `tag`, `de`, `ate`, `pagina`; telefones mascarados |
| `GET /` / `POST /`                                        | Listar/criar rascunho                                             |
| `GET /:id` / `PATCH /:id`                                 | Ler/editar rascunho versionado                                    |
| `POST /:id/previa`                                        | Conferir selecionados/elegíveis/exclusões/duplicatas              |
| `POST /:id/preparar`                                      | Congelar e materializar fila, permitido com envio OFF             |
| `POST /:id/iniciar`, `/pausar`, `/retomar`, `/cancelar`   | Operações versionadas                                             |
| `GET /:id/resultados`                                     | Contagens, destinatários mascarados, respostas e cadência         |
| `GET /:id/auditoria`                                      | Eventos de operação sem valores pessoais                          |
| `POST /:id/destinatarios/:destinatarioId/whatsapp-manual` | Modo manual: revalida, aplica intervalo e devolve telefone/texto  |

Os testes usam Mongo temporário e transporte simulado; nunca apontar runners de teste para o banco real ou usar credenciais reais.

## Atualização cadastral após interesse

No resultado de uma campanha manual, gestor/admin pode usar **Gerar link de atualização** para um contato que respondeu. O link é pessoal, expira em sete dias e vale para um único envio. A pessoa confirma nome, WhatsApp, e-mail, cidade e UF no próprio registro; não cria outro lead, não pede senha nem documento e não altera a autorização comercial. Envie o link somente para o titular e combine a conversa manualmente após receber a confirmação.
