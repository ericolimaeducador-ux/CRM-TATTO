# WhatsApp automático — Tela Viva

A infraestrutura está preparada e **o envio nasce desativado** (`WHATSAPP_ENVIO_ATIVO=false`). Não há credenciais reais nem chamadas externas neste estado. O cadastro e a captura offline continuam livres de campos obrigatórios; o processamento começa depois que o contato chega ao MongoDB da API.

## O que está pronto

O módulo usa `fetch` do Node e a Cloud API oficial da Meta, sem Redis, SDK ou serviço adicional. Um worker local da API reconcilia novos leads a cada cinco segundos, grava uma fila persistente no MongoDB e obtém reservas atômicas antes de enviar. Encerramento da API aguarda o ciclo corrente; reinícios retomam trabalhos pendentes. Uma reserva de envio perdida vira `incerto`, pois o processo pode ter parado depois da Meta aceitar a chamada.

Coleções aditivas: `whatsapp_controle` (marco de instalação), `whatsapp_fila` (um trabalho por contato), `whatsapp_recibos` (confirmações mínimas, TTL de 30 dias) e `whatsapp_bloqueios` (HMAC do telefone que pediu parada). Não há seed nem reescrita de contatos. A fila guarda IDs, hashes, estados e eventos limitados; não duplica nome, telefone em claro, texto de mensagem ou token.

O marco `boas_vindas_v1` é gravado uma vez quando o módulo inicia pela primeira vez, mesmo desligado. A reconciliação considera contatos criados depois desse marco e há no máximo 24 horas. Assim, ativar a integração não dispara boas-vindas para a base histórica. Os trabalhos abertos expiram após 24 horas da criação do lead. O marco deve ser preservado com os volumes Mongo.

## Regras de elegibilidade

- O gatilho é um registro novo na coleção `contatos`: captura manual, QR, sincronização offline ou ingestão de planilha. Contas comerciais e participantes de treinamento não são leads deste gatilho.
- Estados iniciais elegíveis: `rascunho`, `capturado`, `qualificado`. Uma edição ou reenvio com o mesmo `idLocal` não gera nova mensagem.
- Antes da saída, o worker consulta novamente telefone e autorização. Exige `lgpd.contatoComercial=concedido` e um consentimento ativo de `contato_comercial` com versão do termo e hash. O termo existente permite WhatsApp nos canais informados pelo titular. Não se infere autorização de um telefone preenchido ou de legítimo interesse.
- Usa telefone E.164 válido, priorizando o principal, e ignora números marcados `whatsapp=false`. Ausência de telefone ou autorização deixa o trabalho aguardando dentro da janela de 24 horas.
- Revogação, eliminação, descarte ou fusão cancela o trabalho. Solicitação `SAIR`, `PARAR`, `STOP` ou `CANCELAR` recebida no webhook assinado bloqueia aquele telefone por HMAC, inclusive para outros leads com o mesmo número. Não há desbloqueio automático.

## Configuração para futura ativação

Todas as variáveis ficam no ambiente privado da API; os exemplos estão vazios em `.env.example` e o Compose encaminha as variáveis ao container. Não colocar token no frontend nem no Git.

| Variável | Valor a fornecer na ativação |
| --- | --- |
| `WHATSAPP_ENVIO_ATIVO` | `false` agora; `true` somente ao decidir ativar |
| `WHATSAPP_API_VERSAO` | Versão Graph vigente verificada no painel/documentação da Meta, formato `vNN.N`; sem default inventado |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número empresarial cadastrado na Cloud API |
| `WHATSAPP_ACCESS_TOKEN` | Token de sistema com permissão para enviar pelo número |
| `WHATSAPP_TEMPLATE_BOAS_VINDAS` | Nome de template aprovado, de boas-vindas, **sem parâmetros** |
| `WHATSAPP_TEMPLATE_IDIOMA` | Código do idioma aprovado, padrão `pt_BR` |
| `WHATSAPP_APP_SECRET` | App Secret usado para verificar HMAC dos webhooks |
| `WHATSAPP_VERIFY_TOKEN` | Segredo aleatório para o handshake do webhook |

Além da flag, todos os campos precisam ser válidos. Configuração incompleta não consome tentativas nem faz HTTP. A versão não é fixada no código e deve ser fornecida explicitamente; template e idioma devem corresponder ao que foi aprovado na conta Meta. O conteúdo do template é administrado na Meta, não criado nem submetido automaticamente por esta integração.

Exemplo de texto a submeter **posteriormente** como template sem parâmetros: “Olá! Somos a Tela Viva, operada pela JSETTE7. Recebemos seu cadastro e nossa equipe está à disposição. Para deixar de receber mensagens por aqui, responda SAIR.” Este exemplo não implica aprovação pela Meta nem é enviado agora.

Para receber confirmações no futuro, será necessário um endpoint HTTPS acessível à Meta, em `/v1/whatsapp/webhook`, inscrito nos eventos `messages` da conta. GET faz o handshake do verify-token; POST valida `X-Hub-Signature-256` sobre os bytes originais e confere `phone_number_id` antes de processar. A preparação local não abre túnel nem publica a API. O webhook funciona mesmo com o envio desligado, permitindo registrar recibos/opt-out de mensagens já aceitas.

## Estados, erros e retentativas

`aguardando` → `processando` → `aceito` significa que a Meta retornou um `wamid`. Isso não prova entrega. Webhooks assinados atualizam `enviado`, `entregue`, `lido` ou `falha`; notificações repetidas ou fora de ordem não regridem entrega/leitura. Recibos que chegam antes da resposta HTTP são persistidos e reconciliados após gravar o ID da mensagem.

Rejeição HTTP 429 tem backoff exponencial próprio limitado a uma hora e até cinco tentativas. `Retry-After` válido, em segundos ou data HTTP, é respeitado como prazo mínimo, inclusive quando excede uma hora. Se a próxima tentativa alcançar ou ultrapassar a expiração de 24 horas do trabalho, ele vira `expirado` sem novo agendamento. Erros HTTP definitivos viram `falha`. Timeout, HTTP 408/5xx, resposta sem ID ou perda da reserva viram `incerto`, sem reenviar automaticamente. A Cloud API não fornece garantia de exatamente uma entrega pelo identificador local do trabalho; repetir um POST de resultado desconhecido pode duplicar a mensagem. Um operador deve verificar o estado na Meta antes de tratar manualmente um caso incerto. Não há botão público nem rota de reenvio cego.

`GET /v1/whatsapp/status` exige sessão de gestor/admin e devolve modo desativado/pronto/configuração pendente, marco, janela e contagens por estado, sem credenciais ou dados de leads. A leitura é auditada. Não existe endpoint de ativação: a chave é operacional, no ambiente da API.

## Limites da entrega

Os testes usam transporte simulado e Mongo temporário. A conta empresarial, o número, o template aprovado, os tokens e o endpoint público HTTPS precisam ser fornecidos na etapa de ativação. Nenhuma mensagem real é disparada na preparação. O worker depende da API/Mongo locais estarem ligados. A reserva atômica protege concorrência, mas operação em nuvem/múltiplas instâncias exige validação própria de carga, retenção, rede e observabilidade.

Referências oficiais: [política de mensagens WhatsApp](https://business.whatsapp.com/policy), [coleção Meta da Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api), [verificação de webhook no SDK hospedado pela Meta](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/).
