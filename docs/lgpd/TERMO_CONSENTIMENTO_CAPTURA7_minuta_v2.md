# Termo de consentimento e aviso de privacidade — captura7

**Minuta v2 — texto NÃO definitivo**  
**Versão:** v2, de 2026-09-26 (substitui a minuta v1 de 2026-09-26, que permanece arquivada sem alterações)  
**Para revisão e aprovação:** Professor Erico Henrique de Lima Araujo (aprovador final)  
**Autor:** Jurídico LGPD Dados (7Safe) — apoio interno, não vinculante; não substitui revisão de advogado humano antes de qualquer uso externo  
**Base legal:** Lei nº 13.709/2018 (LGPD). Nenhuma jurisprudência citada.  
**Convenção:** `[A PREENCHER]` = dado da 7Safe que eu não tenho. `[DECISÃO Dn]` = trecho que ainda depende de dado/decisão listada em `DECISOES_ERICO_CAPTURA7_v2.md`.

**O que mudou da v1 para a v2 (decisões aprovadas por Erico em 2026-09-26):**
- **D3 — opção (a):** nos eventos (hospitais, congressos), o vendedor colhe o consentimento na hora, no próprio app, usando a mesma tela do autocadastro. Removida a alternativa de legítimo interesse para F1 nos leads de evento. Leads importados de planilha continuam pendentes (D11).
- **D4:** o consentimento para contato comercial é condição para concluir o autocadastro, informada com destaque na versão curta (Art. 9, §3).
- **D6:** enriquecimento mantido como legítimo interesse (Art. 7, IX, e Art. 10); o app descarta nomes de sócios/QSA devolvidos pela BrasilAPI ou ReceitaWS; mantida a cautela sobre MEI.
- **D10:** a trilha de auditoria guarda apenas identificadores pseudonimizados; prazo de guarda do log segue `[A PREENCHER]`.

---

## PARTE 1 — Versão curta (tela do app)

> Usada tanto no **autocadastro por QR code** quanto no **registro feito pelo vendedor no evento** (neste caso, o vendedor entrega o aparelho ao titular ou lê a tela com ele, e é o **próprio titular** quem marca as caixas — D3). As caixas **nunca vêm marcadas**. Cada finalidade tem sua própria caixa (Art. 8, §4: autorizações genéricas são nulas).

---

**Seus dados no captura7**

A **[RAZÃO SOCIAL DA 7SAFE — A PREENCHER, D1]**, CNPJ **[A PREENCHER, D1]**, vai tratar os dados que você informar aqui (nome, contato, cargo e instituição e, se você informar, o CNPJ e o CEP da sua empresa).

> **Importante: este cadastro existe para que a 7Safe possa entrar em contato com você para apresentar produtos e serviços. Por isso, sem a autorização de contato comercial abaixo não é possível concluir o cadastro.** Você pode revogar essa autorização depois, a qualquer momento e de graça.

**Marque o que você autoriza:**

☐ **Contato comercial (necessário para concluir o cadastro).** Autorizo a 7Safe a entrar em contato comigo por **[e-mail / telefone / WhatsApp — A PREENCHER, DECISÃO D5]** para apresentar produtos e serviços.

☐ **Envio ao sistema de gestão (ERP).** Se eu me tornar cliente, autorizo o envio dos meus dados de contato ao sistema de gestão da 7Safe, fornecido por **[FORNECEDOR — A PREENCHER]**. **[DECISÃO D7: esta caixa só existe se o fornecedor do ERP for um controlador separado. Se ele apenas operar para a 7Safe, a caixa sai e o item vira informação, como os dois abaixo.]**

**Para sua informação (não depende de marcação):**

- **Dados da empresa.** Se você informar um CNPJ ou CEP, consultamos bases públicas (BrasilAPI ou ReceitaWS, e ViaCEP) para completar razão social e endereço. **Nomes de sócios que essas bases devolverem são descartados e não ficam guardados.** Você pode se opor a essa consulta a qualquer momento.
- **Exportação.** Somente gestores autorizados, com verificação em duas etapas, podem exportar a base, e apenas para **[FINALIDADE — A PREENCHER, DECISÃO D8]**.

Você pode **revogar** sua autorização quando quiser, de graça, em **[CANAL — A PREENCHER]**. Guardamos seus dados por **[PRAZO — A PREENCHER, D9]**. Encarregado de dados / canal de contato: **[NOME / E-MAIL — A PREENCHER, D2]**.

[ Ler o termo completo ]  [ Concluir cadastro ] *(botão só habilitado com a caixa "Contato comercial" marcada — D4)*

*Versão do termo: [A PREENCHER, D1] — registrada com data e hora da sua escolha e com a forma de coleta (QR code ou vendedor).*

---

## PARTE 2 — Versão completa

### 1. Quem trata seus dados (controlador)

**[RAZÃO SOCIAL DA 7SAFE — A PREENCHER, D1]**, CNPJ **[A PREENCHER, D1]**, com sede em **[ENDEREÇO — A PREENCHER, D1]** ("7Safe"), é a controladora dos dados tratados no aplicativo captura7, nos termos do Art. 5, VI, da LGPD.

### 2. Quais dados tratamos

| Categoria | Dados | Observação |
|-----------|-------|------------|
| Identificação e contato (pessoa física) | Nome, e-mail, telefone, cargo, instituição onde trabalha | Informados por você, diretamente ou junto com o vendedor da 7Safe no evento |
| Dados da empresa (pessoa jurídica) | CNPJ, razão social, nome fantasia, endereço, CEP | Dados de pessoa jurídica, em regra, não são dados pessoais. **Exceção — MEI e empresário individual:** o CNPJ e a razão social podem identificar uma pessoa física; nesse caso, esses dados são tratados como dados pessoais e seguem este termo. **Nomes de sócios (quadro societário) devolvidos pelas bases públicas são descartados pelo app e não são armazenados** (Art. 6, III) |
| Registro de consentimento | Finalidades autorizadas, data e hora, versão do termo, forma de coleta (QR code ou vendedor no evento) e identificação do vendedor, quando houver | Necessário para comprovar o consentimento (Art. 8, §2) |
| Registros de uso e segurança | Ações feitas no app (quem, o quê, quando) | Trilha de auditoria com **identificadores pseudonimizados** (pseudonimização, conforme o conceito do Art. 13, §4), sem nome, e-mail ou telefone em claro |

O captura7 **não** foi feito para coletar dados de saúde nem outros dados pessoais sensíveis (Art. 5, II). Não informe esse tipo de dado em campos livres.

### 3. De onde vêm os dados

1. **Autocadastro:** você mesmo preenche, após ler um QR code, e marca as autorizações.
2. **Vendedor da 7Safe no evento:** em hospitais e congressos, o vendedor pode registrar seus dados com você, no próprio app. Nesse caso, **a mesma tela de autorizações deste termo é apresentada a você na hora, e é você quem marca as caixas**. Sem a autorização de contato comercial, o registro não é concluído.
3. **Planilha (Google Sheets):** a 7Safe pode importar contatos de planilhas próprias. **[DECISÃO D11 — PENDENTE: origem desses dados e como o titular é informado (Art. 9). Enquanto não houver registro de consentimento válido para esses contatos, eles NÃO podem ser tratados com base no consentimento; a base legal e o aviso ao titular dependem da resposta de D11.]**
4. **Bases públicas:** quando há CNPJ ou CEP, consultamos BrasilAPI ou ReceitaWS e ViaCEP.

### 4. Finalidades e bases legais

| # | Finalidade | O que fazemos | Base legal (LGPD) | Como você controla |
|---|-----------|---------------|-------------------|--------------------|
| F1 | **Contato comercial** | Contatá-lo pelos canais que você autorizou para apresentar produtos e serviços da 7Safe | **Consentimento** — Art. 7, I, com os requisitos do Art. 8 (manifestação destacada, finalidade determinada, prova pelo controlador, revogação). Vale para o autocadastro **e** para os leads registrados pelo vendedor no evento, que colhe o consentimento na hora, na mesma tela. Esta autorização é **condição para concluir o cadastro**, o que é informado com destaque (Art. 9, §3). **Leads importados de planilha: pendente (D11)** — não podem ser tratados com base no consentimento sem registro dele | Caixa própria; revogação a qualquer momento (Art. 8, §5, e Art. 18, IX) |
| F2 | **Enriquecimento** | Completar razão social e endereço a partir de CNPJ e CEP em bases públicas | **Legítimo interesse** — Art. 7, IX, e Art. 10, usando só os dados estritamente necessários (Art. 10, §1) e com transparência (Art. 10, §2); observância do Art. 7, §§3º, 4º e 7º para dados de acesso público. **Nomes de sócios/QSA devolvidos são descartados** (Art. 6, III). Cautela no caso de MEI/empresário individual, em que o CNPJ identifica pessoa física | Direito de oposição (Art. 18, §2) |
| F3 | **Envio ao ERP** | Quando você se torna cliente, seus dados de contato são enviados automaticamente ao sistema de gestão da 7Safe | **[DECISÃO D7]** Se o fornecedor do ERP for **operador** da 7Safe (trata só por ordem dela, Art. 39): a base é a mesma da relação de cliente — execução de contrato ou procedimentos preliminares (Art. 7, V) quando você é parte do contrato, ou legítimo interesse (Art. 7, IX) quando você representa a empresa cliente. Se o fornecedor for **controlador** separado: consentimento específico para esse compartilhamento (Art. 7, §5) | Informação neste termo; caixa própria se exigida pelo Art. 7, §5 |
| F4 | **Exportação da base** | Gestores ou administradores, com verificação em duas etapas (TOTP), exportam a base em CSV, XLSX ou JSON | A exportação não é uma finalidade autônoma; ela é uma operação de tratamento (Art. 5, X: extração, transferência) que segue a base da finalidade que a motiva: **[FINALIDADE DA EXPORTAÇÃO — A PREENCHER, DECISÃO D8]**. Aplicam-se os princípios da finalidade e da necessidade (Art. 6, I e III) e o dever de segurança (Art. 46) | Somente registros com base legal válida são exportados; a exportação fica na trilha de auditoria |

Não usamos seus dados para outras finalidades sem informar você antes e, quando a base for o consentimento, sem pedir um novo consentimento (Art. 8, §6, e Art. 9, §2).

### 5. Com quem compartilhamos

| Destinatário | Por quê | Papel |
|--------------|---------|-------|
| **[PROVEDOR DE HOSPEDAGEM / NUVEM — A PREENCHER, D12]** | Armazenar o app e a base | Operador (Art. 39) |
| Google (Google Sheets) | Importação de planilhas | Operador **[A CONFIRMAR]** |
| BrasilAPI / ReceitaWS / ViaCEP | Consulta de CNPJ e CEP | Recebem apenas o CNPJ ou o CEP consultado; os nomes de sócios que devolvem são descartados pelo app |
| **[FORNECEDOR DO ERP — A PREENCHER]** | Gestão de clientes | **[Operador ou controlador — DECISÃO D7]** |

Não vendemos seus dados.

### 6. Transferência internacional

**[A PREENCHER — DECISÃO D12]** Se algum destinatário armazenar dados fora do Brasil, indicar o país e o mecanismo usado, conforme os Arts. 33 a 36 da LGPD.

### 7. Segurança

Adotamos medidas técnicas e administrativas de segurança (Art. 46), entre elas: cifragem em repouso dos dados que a 7Safe classifica como confidenciais; exportação restrita a gestores e administradores, com verificação em duas etapas; e registro das ações em trilha de auditoria que usa apenas identificadores pseudonimizados. O app funciona offline; os registros feitos sem conexão ficam **[A PREENCHER: onde e como protegidos no dispositivo]** até a sincronização.

### 8. Por quanto tempo guardamos

Os dados são eliminados ao fim do tratamento (Art. 15), por exemplo quando a finalidade é alcançada ou quando você revoga o consentimento, salvo nas hipóteses de conservação do Art. 16 (como cumprimento de obrigação legal ou uso exclusivo da 7Safe com dados anonimizados).

| Situação | Prazo |
|----------|-------|
| Lead ativo, sem resposta | **[A PREENCHER — D9]** |
| Lead que revogou o consentimento | **[A PREENCHER — D9]** (eliminação, ressalvado o Art. 16) |
| Cliente (dados no ERP) | **[A PREENCHER — D9]** |
| Registro de consentimento e revogação | **[A PREENCHER — D9]** |
| Trilha de auditoria (identificadores pseudonimizados) | **[A PREENCHER — D9/D10]** |

### 9. Seus direitos e como revogar

Você pode, a qualquer momento e sem custo (Art. 18, §5):

- confirmar se tratamos seus dados e acessá-los (Art. 18, I e II);
- corrigir dados incompletos, inexatos ou desatualizados (Art. 18, III);
- pedir anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade (Art. 18, IV);
- pedir a portabilidade (Art. 18, V);
- pedir a eliminação dos dados tratados com base no seu consentimento, ressalvado o Art. 16 (Art. 18, VI);
- saber com quem compartilhamos seus dados (Art. 18, VII);
- saber que pode não consentir e quais as consequências disso (Art. 18, VIII) — **no captura7, a consequência de não autorizar o contato comercial é não concluir o cadastro**, porque esse é o objetivo dele;
- **revogar o consentimento** (Art. 18, IX, e Art. 8, §5);
- opor-se a tratamento feito com base em outra hipótese legal, como o enriquecimento, se houver descumprimento da LGPD (Art. 18, §2);
- peticionar à Autoridade Nacional de Proteção de Dados — ANPD (Art. 18, §1).

**Como revogar:** envie seu pedido para **[CANAL — A PREENCHER: e-mail, formulário ou botão no app]**. A revogação é gratuita e facilitada e vale a partir do pedido; o tratamento feito antes dela continua válido enquanto não houver pedido de eliminação (Art. 8, §5).

**Prazo de resposta:** a confirmação de existência ou o acesso aos dados é fornecido de imediato, em formato simplificado, ou em até 15 dias, por declaração completa (Art. 19, I e II).

### 10. Encarregado (DPO) e contato

Encarregado pelo tratamento de dados pessoais: **[NOME — A PREENCHER]**, **[E-MAIL — A PREENCHER]**, **[OUTRO CANAL — A PREENCHER]** (Art. 41). **[DECISÃO D2]**

### 11. Alterações deste termo

Se este termo mudar de forma relevante, avisaremos você. Se a mudança afetar uma finalidade autorizada por consentimento, pediremos nova autorização (Art. 8, §6). Versão atual: **[A PREENCHER, D1]**, de **[DATA — A PREENCHER, D1]**.

### 12. Declaração

Declaro que li este termo e que as autorizações que marquei acima expressam minha vontade livre, informada e inequívoca (Art. 5, XII).

*Registro automático: finalidades marcadas, data e hora, versão do termo, forma de coleta (QR code ou vendedor no evento), identificador pseudonimizado do vendedor (quando houver) e identificador do dispositivo.*

---

## PARTE 3 — Requisitos para a Engenharia (não vão para o titular)

1. **Caixas desmarcadas por padrão**, uma por finalidade que dependa de consentimento.
2. **Condição de conclusão (D4):** o botão "Concluir cadastro" só habilita com a caixa de contato comercial marcada; a frase de destaque da Parte 1 deve aparecer **acima** das caixas, legível em celular, sem exigir rolagem para ser vista.
3. **Fluxo do vendedor (D3):** o registro feito pelo vendedor no evento deve usar **a mesma tela** de autorizações do autocadastro; é o titular quem marca as caixas. Sem consentimento de contato comercial, o registro não é concluído (não criar "lead sem consentimento" no fluxo de evento). Gravar a forma de coleta = `vendedor_evento` e o identificador pseudonimizado do vendedor.
4. **Leads de planilha (D11 — pendente):** importados sem registro de consentimento devem ficar marcados como **sem base de consentimento** e bloqueados para F1 e para exportação com essa finalidade até a decisão de D11.
5. **Prova do consentimento** (Art. 8, §2): gravar versão do termo, finalidades marcadas, data e hora, forma de coleta e hash do texto exibido. Registros offline precisam manter a data e hora do dispositivo e a da sincronização.
6. **Revogação** deve bloquear imediatamente F1 (e F3, se baseada em consentimento), sincronizar entre dispositivos e impedir a exportação daquele registro para essa finalidade.
7. **Exportação**: incluir apenas registros com base legal válida para a finalidade declarada; registrar na trilha quem exportou, quando, formato, filtro e quantidade de registros.
8. **Webhook do ERP**: enviar apenas os campos necessários (Art. 6, III) e só para leads promovidos a cliente.
9. **Consulta de CNPJ (D6):** descartar do payload, **antes de qualquer persistência** (banco, cache, fila offline, logs), os nomes de sócios/QSA devolvidos pela BrasilAPI ou ReceitaWS; persistir somente razão social, nome fantasia, endereço e CEP. Para CNPJ de MEI/empresário individual, tratar os dados retornados como dados pessoais (mesmas regras de acesso, retenção e eliminação dos dados de contato).
10. **Trilha de auditoria imutável (D10):** gravar apenas identificadores pseudonimizados (ex.: ID interno ou hash com segredo guardado fora do log), nunca nome, e-mail ou telefone em claro, para que a eliminação do cadastro seja possível sem violar a imutabilidade do log. Prazo de guarda do log: **[A PREENCHER — D9/D10]**.
