# Termo de consentimento — captura7

Versão `2026-09-26-uso-pessoal`. Controlador: pessoa física Erico Henrique de Lima Araujo. Uso pessoal. Não há CNPJ. A publicação na nuvem está na ADR-011.

**Seus dados no captura7**

Erico Henrique de Lima Araujo, pessoa física, vai tratar os dados que você informar aqui (nome, contato e, se você informar, documento e endereço da empresa). Não há pessoa jurídica nem CNPJ neste uso.

> **Importante: este cadastro existe para que o controlador possa entrar em contato com você para apresentar produtos e serviços. Por isso, sem a autorização de contato comercial abaixo não é possível concluir o cadastro.** Você pode revogar essa autorização depois, a qualquer momento e de graça.

☐ **Contato comercial (necessário para concluir o cadastro).** Autorizo o contato por e-mail, telefone ou WhatsApp, nos canais que eu mesmo informar, para apresentar produtos e serviços.

☐ **Envio a sistema externo (opcional).** Se eu me tornar cliente e o controlador configurar um webhook, autorizo o envio dos meus dados de contato a esse destino. Sem esta caixa, nada é enviado. Hoje o envio nasce desligado.

- **Exportação.** O administrador, com verificação em duas etapas, pode exportar a base em CSV ou XLSX para uso pessoal do controlador. A exportação fica na trilha de auditoria, com quem exportou e quando.
- **Planilha.** Leads importados de CSV, XLSX ou Google Sheets entram com origem "importado" e base legal de legítimo interesse. Não são tratados como se você tivesse marcado a caixa de consentimento.

Você pode **revogar** sua autorização quando quiser, de graça, pelo e-mail {{CONTROLADOR_EMAIL}} ou pela tela de autorizações do aplicativo. Guardamos seus dados por **{{RETENCAO_MESES}} meses sem interação**; depois disso o cadastro é eliminado. Um rascunho parado por **{{RASCUNHO_DIAS}} dias** também é eliminado. Depois da revogação, o cadastro é eliminado automaticamente em **{{PURGA_REVOGACAO_DIAS}} dias**, e o documento sai {{PURGA_REVOGACAO_DIAS}} dias depois da eliminação. A trilha de auditoria não é apagada. Canal de contato do controlador: **{{CONTROLADOR_EMAIL}}**.

*Versão do termo: 2026-09-26-uso-pessoal — registrada com data e hora da sua escolha e com a forma de coleta (QR code ou vendedor).*

## PARTE 2 — Versão completa

**Erico Henrique de Lima Araujo**, pessoa física, sem CNPJ, é o controlador dos dados tratados no aplicativo captura7, nos termos do Art. 5, VI, da LGPD. O contato é {{CONTROLADOR_EMAIL}}. O encarregado, neste uso pessoal, é o próprio controlador, no mesmo e-mail.

Os dados ficam em serviços de nuvem contratados pelo controlador: o Google Firebase Hosting guarda as telas, o Render guarda o servidor nos Estados Unidos e o MongoDB Atlas guarda o banco em São Paulo, no Brasil (AWS, região sa-east-1, plano gratuito M0), no host cluster0.tbl9r9u.mongodb.net. A transferência internacional (art. 33 da LGPD) ocorre no Render, nos Estados Unidos, e pode ocorrer no Firebase Hosting, porque a rede de distribuição das telas é global. O banco permanece no Brasil. O caminho no computador do controlador continua disponível para quem não publicar.

| Código | Finalidade | O que acontece | Base legal | Como você controla |
|---|---|---|---|---|
| F1 | **Contato comercial** | Contato pelos canais que você informou | **Consentimento** — Art. 7, I, e Art. 8. Vale para o autocadastro e para o lead em que o vendedor colhe a caixa na hora. A caixa é condição para concluir o autocadastro (Art. 9, §3) | Caixa própria; revogação a qualquer momento (Art. 8, §5, e Art. 18, IX) |
| F2 | **Uso da base importada** | Leads de planilha entram para organização pessoal do controlador | **Legítimo interesse** — Art. 7, IX. A origem fica marcada como importado. A caixa de consentimento não é marcada sozinha | Você pode pedir eliminação (Art. 18, VI) |
| F3 | **Envio a sistema externo** | Se um destino for configurado e você autorizar, o contato de cliente segue para esse endereço | Consentimento específico `envio_erp`. Sem a caixa, o destino não recebe o registro. Enquanto o controlador não configurar o destino, o envio fica desligado e não gera erro | Caixa opcional |
| F4 | **Exportação da base** | O administrador, com TOTP, exporta CSV ou XLSX | Uso pessoal do controlador. Só saem contatos com consentimento de contato comercial válido e ativo. Revogados, eliminados e sem essa autorização ficam de fora. A trilha guarda autor, papel, formato, filtros, quantidade e horário | Só o administrador, com passo extra |

| Quem recebe | Para quê | Papel |
|---|---|---|
| Google Firebase Hosting | Guardar as telas do aplicativo | Operador contratado pelo controlador |
| Render | Guardar o servidor nos Estados Unidos | Operador contratado pelo controlador |
| MongoDB Atlas | Guardar o banco em São Paulo, no Brasil (AWS sa-east-1, host cluster0.tbl9r9u.mongodb.net) | Operador contratado pelo controlador |
| Sistema externo que o controlador configurar | Enviar contato de cliente, se você autorizar | Destino opcional. Desligado enquanto o controlador não configurar esse destino |

A transferência internacional (art. 33 da LGPD) fica no servidor do Render, nos Estados Unidos, e pode ocorrer nas telas do Firebase Hosting, porque a rede de distribuição é global. O banco do MongoDB Atlas fica em São Paulo, no Brasil.

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

Se este termo mudar de forma relevante e a mudança afetar uma finalidade autorizada por consentimento, pediremos nova autorização (Art. 8, §6). Versão atual: **2026-09-26-uso-pessoal**, de 26/09/2026.

## PARTE 3 — Notas de operação

Decisões fechadas na ADR-010: D1 pessoa física sem CNPJ; D2 o controlador é o canal; D5 canais informados pelo titular; D7 webhook opcional e desligado; D8 exportação de uso pessoal; D9 {{RETENCAO_MESES}} meses sem interação; D11 planilha com legítimo interesse e origem importado. A ADR-011 descreve o Google Firebase Hosting, o Render (servidor nos Estados Unidos) e o MongoDB Atlas (banco em São Paulo, no Brasil). A transferência internacional fica no Render e, eventualmente, no Firebase Hosting. O texto final do termo precisa da revisão do Jurídico LGPD Dados, só do captura7. O campo `conflito` grava as duas versões no servidor para escolha humana. O caminho no computador local continua em INSTALAR-WINDOWS.md.
