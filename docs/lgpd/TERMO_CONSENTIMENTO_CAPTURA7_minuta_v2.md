# Termo de consentimento — Tela Viva

Versão `2026-11-16-tela-viva-jsette7`. Controladora: JSETTE7 Comércio de Produtos Médicos e Hospitalares LTDA, CNPJ 54.765.439/0001-34, operadora da marca Tela Viva. Dados armazenados no computador local da operação.

**Seus dados no Tela Viva**

JSETTE7 Comércio de Produtos Médicos e Hospitalares LTDA, CNPJ 54.765.439/0001-34, operadora da marca Tela Viva, vai tratar os dados que você informar aqui (nome, contato e, se você informar, documento e endereço da empresa).

> **Importante: este cadastro existe para que o controlador possa entrar em contato com você para apresentar produtos e serviços. Por isso, sem a autorização de contato comercial abaixo não é possível concluir o cadastro.** Você pode revogar essa autorização depois, a qualquer momento e de graça.

☐ **Contato comercial (necessário para concluir o cadastro).** Autorizo o contato por e-mail, telefone ou WhatsApp, nos canais que eu mesmo informar, para apresentar produtos e serviços.

☐ **Envio a sistema externo (opcional).** Se eu me tornar cliente e o controlador configurar um webhook, autorizo o envio dos meus dados de contato a esse destino. Sem esta caixa, nada é enviado. Hoje o envio nasce desligado.

- **Exportação.** O administrador, com verificação em duas etapas, pode exportar a base em CSV ou XLSX para organização comercial da controladora. A exportação fica na trilha de auditoria, com quem exportou e quando.
- **Planilha.** Leads importados de CSV, XLSX ou Google Sheets entram com origem "importado" e base legal de legítimo interesse. Não são tratados como se você tivesse marcado a caixa de consentimento.

Você pode **revogar** sua autorização quando quiser, de graça, pelo e-mail {{CONTROLADOR_EMAIL}} ou pela tela de autorizações do aplicativo. Guardamos seus dados por **{{RETENCAO_MESES}} meses sem interação**; depois disso o cadastro é eliminado. Um rascunho parado por **{{RASCUNHO_DIAS}} dias** também é eliminado. Depois da revogação, o cadastro é eliminado automaticamente em **{{PURGA_REVOGACAO_DIAS}} dias**, e o documento sai {{PURGA_REVOGACAO_DIAS}} dias depois da eliminação. A trilha de auditoria não é apagada. Canal de contato do controlador: **{{CONTROLADOR_EMAIL}}**.

*Versão do termo: 2026-11-16-tela-viva-jsette7 — registrada com data e hora da sua escolha e com a forma de coleta (QR code ou vendedor).*

## PARTE 2 — Versão completa

**JSETTE7 Comércio de Produtos Médicos e Hospitalares LTDA**, CNPJ 54.765.439/0001-34, é a controladora dos dados tratados no aplicativo Tela Viva. Endereço: Av. Paulo Afonso, 615, Nova Petrópolis, São Bernardo do Campo/SP, CEP 09770-351. O canal de solicitações sobre dados pessoais é {{CONTROLADOR_EMAIL}}.

Os dados ficam no **computador local do controlador**. Não há provedor de nuvem nem transferência internacional.

| Código | Finalidade | O que acontece | Base legal | Como você controla |
|---|---|---|---|---|
| F1 | **Contato comercial** | Contato pelos canais que você informou | **Consentimento** — Art. 7, I, e Art. 8. Vale para o autocadastro e para o lead em que o vendedor colhe a caixa na hora. A caixa é condição para concluir o autocadastro (Art. 9, §3) | Caixa própria; revogação a qualquer momento (Art. 8, §5, e Art. 18, IX) |
| F2 | **Uso da base importada** | Leads de planilha entram para organização comercial da controladora | **Legítimo interesse** — Art. 7, IX. A origem fica marcada como importado. A caixa de consentimento não é marcada sozinha | Você pode pedir eliminação (Art. 18, VI) |
| F3 | **Envio a sistema externo** | Se um webhook for configurado e você autorizar, o contato de cliente segue para esse endereço | Consentimento específico `envio_erp`. Sem a caixa, o webhook não envia o registro. Com a variável vazia, o envio fica desligado e não gera erro | Caixa opcional |
| F4 | **Exportação da base** | O administrador, com TOTP, exporta CSV ou XLSX | Organização comercial da controladora. Só saem contatos com consentimento de contato comercial válido e ativo. Revogados, eliminados e sem essa autorização ficam de fora. A trilha guarda autor, papel, formato, filtros, quantidade e horário | Só o administrador, com passo extra |

| Quem recebe | Para quê | Papel |
|---|---|---|
| Computador local do controlador | Guardar o aplicativo e a base | O próprio controlador. Não há operador de nuvem |
| Webhook que o controlador configurar | Enviar contato de cliente, se você autorizar | Destino opcional. Desligado quando `ERP_WEBHOOK_URL` está vazio |

Não há destinatário no exterior. Os Arts. 33 a 36 não se aplicam a este uso.

Medidas do Art. 46: cifragem em repouso dos documentos; exportação só do administrador, com verificação em duas etapas; trilha de auditoria com identificadores pseudonimizados para nome, e-mail e telefone. No aparelho, o rascunho fica no IndexedDB e no armazenamento local do navegador até a sincronização, protegido pela sessão do aparelho.

| Situação | Prazo |
|---|---|
| Lead sem interação | {{RETENCAO_MESES}} meses a partir da última alteração; depois o cadastro é eliminado |
| Rascunho parado | {{RASCUNHO_DIAS}} dias sem alteração; depois o cadastro é eliminado |
| Lead que revogou o consentimento | Eliminação automática {{PURGA_REVOGACAO_DIAS}} dias após a revogação. Até lá, contato comercial, envio externo e exportação ficam bloqueados. O pedido do titular (Art. 18, VI) também elimina na hora, depois de confirmar o nome ou a palavra ELIMINAR |
| Documento já eliminado | Apagado {{PURGA_REVOGACAO_DIAS}} dias depois da eliminação. A trilha de auditoria permanece |
| Registro de consentimento e revogação | O mesmo prazo de {{RETENCAO_MESES}} meses, junto do cadastro |
| Trilha de auditoria pseudonimizada | Não é apagada por este prazo. Ela não guarda nome, e-mail nem telefone em claro (Art. 16) |

**Seus direitos (Art. 18).** Confirmação e acesso, correção, anonimização, bloqueio ou eliminação, informação sobre compartilhamento, e revogação do consentimento. A eliminação (Art. 18, VI) apaga os dados do cadastro e não reescreve a trilha antiga.

**Como revogar:** escreva para {{CONTROLADOR_EMAIL}} ou use a tela de autorizações. A revogação é gratuita e vale a partir do pedido. O cadastro é eliminado automaticamente {{PURGA_REVOGACAO_DIAS}} dias depois. A trilha de auditoria não é apagada (Art. 8, §5, e Art. 16).

Se este termo mudar de forma relevante e a mudança afetar uma finalidade autorizada por consentimento, pediremos nova autorização (Art. 8, §6). Versão atual: **2026-11-16-tela-viva-jsette7**, de 16/11/2026.

## PARTE 3 — Notas de operação

Identidade atualizada pela ADR-013: controladora JSETTE7, conforme fonte oficial e confirmação do usuário em 16/11/2026. Os demais controles da ADR-010 permanecem: D5 canais informados pelo titular; D7 webhook opcional e desligado; D8 exportação de uso pessoal; D9 {{RETENCAO_MESES}} meses sem interação; D11 planilha com legítimo interesse e origem importado; D12 computador local, sem transferência internacional. O campo `conflito` grava as duas versões no servidor para escolha humana.
