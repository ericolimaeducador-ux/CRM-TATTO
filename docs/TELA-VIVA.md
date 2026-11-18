# Tela Viva — contrato comercial

O módulo é aditivo à base de contatos existente. Seus dados ficam na coleção `tela_viva_comercial` do mesmo MongoDB. Não há seed automático, migração destrutiva nem importação implícita dos contatos existentes para contas.

## Carteira e rotina

- **Contas**: instituições da carteira, segmento, especialidade, território, classificação ABC, frequência de visita, endereço, interlocutor e próxima ação.
- **Agenda**: visitas presenciais/remotas, reuniões, ligações, e-mails e tarefas; data, resultado e próxima ação; estados planejada, concluída e cancelada.
- **Oportunidades**: prospecção, qualificação, apresentação, proposta, negociação, ganho e perdido; conta, previsão, probabilidade e valor em centavos.
- **Produtos**: linhas representadas, fabricante, código, categoria, unidade e preço de referência. Leitura compartilhada, escrita de gestão.
- **Propostas**: rascunhos comerciais com conta/oportunidade, validade, condições e itens. Os totais são recalculados pelo servidor. Impressão local não envia a proposta ao cliente.

Um representante só lê/escreve sua carteira. Gestor e administrador têm visão ampliada; auditor só lê e não acessa registros pessoais de participantes. As rotas usam a mesma sessão opaca e as mesmas proteções de autenticação do app existente. Nenhum cabeçalho de teste autentica em produção.

## Relacionamento, preços e treinamentos

- Contas aceitam várias pessoas de contato e um contato principal ativo; propostas podem selecionar um contato ativo da conta.
- Preços por cliente/produto têm solicitação, aprovação/reprovação pela gestão e encerramento ganho/perdido, com motivo, versão e histórico.
- Atividades aceitam responsável e colaboradores existentes, ativos e com papel comercial. A realização registra autor e horário do servidor.
- Treinamentos aceitam inscrição pública por QR com token restrito e validade. Inscrições manuais e públicas deduplicam por evento/e-mail; confirmação e presença são controladas pela gestão.
- Participantes podem ser exportados em CSV/XLSX por gestor/admin com TOTP, auditoria e limite de 2.000 linhas.
- Relatórios oferecem totais por período/carteira, sem listas pessoais. As datas são dias inclusivos em `America/Sao_Paulo`, com janela máxima de 366 dias.
- O preparo de proposta para e-mail registra uma solicitação auditada e abre um rascunho no cliente local. Não há SMTP configurado nem confirmação de entrega.

## API

Prefixo `/v1/comercial`. O cliente envia os cabeçalhos da sessão existente.

| Método e rota | Efeito |
| --- | --- |
| `GET /painel` | Indicadores, funil e atividades/contas recentes reais |
| `GET /relatorios?de=AAAA-MM-DD&ate=AAAA-MM-DD` | Totais comerciais por calendário de São Paulo; gestão pode filtrar `representanteId` |
| `POST /precosCliente/:id/aprovar` ou `/reprovar` | Decisão da gestão, com versão e motivo |
| `POST /precosCliente/:id/encerrar` | Encerra preço aprovado como ganho ou perdido |
| `POST /treinamentos/:id/qr` | Gera/substitui token de inscrição do evento |
| `GET/POST /publico/treinamentos/:token` | Consulta pública mínima e inscrição idempotente |
| `GET /treinamentos/:id/participantes/exportar?formato=csv` | Exportação protegida; também aceita `xlsx` |
| `POST /propostas/:id/rascunho-email` | Valida contato/versão e audita solicitação de rascunho |
| `GET /:secao` | Lista paginada; `q`, `pagina`, `limite` até 100, `contaId`, `etapa`, `status`, `arquivados=true` |
| `POST /:secao` | Cria um rascunho comercial com autoria do servidor |
| `GET /:secao/:id` | Consulta individual respeitando a carteira |
| `PATCH /:secao/:id` | Atualiza campos permitidos com `versao` conhecida |
| `GET /:secao/:id/auditoria` | Eventos append-only, pseudonimizados |

Seções: `contas`, `produtos`, `oportunidades`, `atividades`, `propostas`, `precosCliente`, `treinamentos`, `participantes`. As listas retornam `{registros,total,pagina,limite}`; escritas e consultas individuais retornam `{registro}`. O uso de `registro` separa a auditoria comercial do interceptor legado de contatos.

Arquivar usa PATCH com `{versao,arquivado:true}`. Restaurar usa `false`. Conflito de versão retorna 409 e exige atualizar a tela; não há sobrescrita silenciosa. Valores em centavos são inteiros; a interface exibe reais. Nenhum total recebido do cliente é aceito como fonte de verdade.

## Conexão e compatibilidade

A captura por QR/manual continua offline-first. As novas telas comerciais exigem conexão e não prometem salvamento quando a API não confirma. Os nomes de banco, pacotes, variáveis e chaves `captura7` são mantidos por compatibilidade; **Tela Viva** é o nome do produto.

As integrações de Sheets, exportação e webhook continuam sendo as da base existente. Nenhuma credencial, destino externo, regra sanitária, distribuição de amostras, prontuário ou faturamento é criado automaticamente.

A fase atual funciona localmente em Docker. O rate limit da inscrição é em memória; nuvem/múltiplas instâncias, SMTP e câmera física aguardam etapa própria. A bateria final confirmou API 162 testes/37 suítes e E2E 10 cenários. Evidências e limites estão em `PROGRESS_FASE_PARIDADE.md`.
