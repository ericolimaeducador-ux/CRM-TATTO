const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium, expect } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const out = path.join(root,'docs/treinamento-tela-viva');
const rt = path.join(root,'test-results/treinamento-runtime');
fs.mkdirSync(path.join(out,'prints'),{recursive:true});
const json = (p, fallback) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p,'utf8')) : fallback;
const stateFile=path.join(rt,'cenario.json'), browserFile=path.join(rt,'browser.json');
const s=json(stateFile,{next:1}), shots=json(path.join(out,'etapas.json'),[]);
const save=()=>fs.writeFileSync(stateFile,JSON.stringify(s,null,2));
const date=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
function totp(secret) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits='';
  for(const c of secret.toUpperCase().replace(/=+$/,'')) bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');
  const key=Buffer.from(bits.match(/.{8}/g).map(x=>parseInt(x,2)));
  const counter=Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const hash=crypto.createHmac('sha1',key).update(counter).digest();const o=hash[19]&15;
  return ((hash.readUInt32BE(o)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
async function main(){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'pt-BR',timezoneId:'America/Sao_Paulo', ...(fs.existsSync(browserFile)?{storageState:browserFile}:{})});
  const page=await context.newPage(); page.setDefaultTimeout(20000);
  const apiErrors=[];
  page.on('response',r=>{if(r.url().includes('/v1/')&&r.status()>=400)apiErrors.push({status:r.status(),url:r.url().split('?')[0]})});
  const go=async p=>{await page.goto('http://127.0.0.1:4173'+p);await page.waitForTimeout(650)};
  const fill=async(label,value)=>page.getByLabel(label,{exact:true}).fill(String(value));
  const select=async(label,value)=>page.getByRole('combobox',{name:label,exact:true}).selectOption(value);
  const click=async name=>page.getByRole('button',{name,exact:true}).click();
  const api=async(p,method='GET',body)=>page.evaluate(async({p,method,body})=>{const r=await fetch('http://127.0.0.1:3101'+p,{method,headers:{'content-type':'application/json',authorization:'Bearer '+localStorage.getItem('captura7.token')},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(JSON.stringify(data));return data},{p,method,body});
  async function shot(id,title,steps,result,note='',focus){
    if(focus)await page.locator('label').filter({hasText:focus}).locator('input,select,textarea').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(180);await page.evaluate(()=>document.fonts.ready);
    const file=`${String(id).padStart(2,'0')}.png`;
    await page.screenshot({path:path.join(out,'prints',file),animations:'disabled'});
    const item={id,title,steps,result,note,file:'prints/'+file,route:new URL(page.url()).pathname};
    const i=shots.findIndex(x=>x.id===id);if(i<0)shots.push(item);else shots[i]=item;
    fs.writeFileSync(path.join(out,'etapas.json'),JSON.stringify(shots.sort((a,b)=>a.id-b.id),null,2));
    console.log(`PRINT ${id}: ${title}`);
  }
  async function record(section,method='POST',id){
    const p=page.waitForResponse(r=>r.url().endsWith('/v1/comercial/'+section+(id?'/'+id:''))&&r.request().method()===method);
    await click('Salvar na carteira');const r=await p;if(!r.ok())throw Error(await r.text());await expect(page.getByRole('dialog')).toHaveCount(0);return (await r.json()).registro;
  }
  async function task(n,fn){if(s.next>n)return;console.log('ETAPA '+n);await fn();s.next=n+1;save();await context.storageState({path:browserFile,indexedDB:true});}
  try {
    await task(1,async()=>{
      await go('/entrar'); const access=json(path.join(rt,'acesso.json'));
      await fill('Usuário',access.login);await fill('Senha',access.senha);
      await shot(1,'Entrar no Tela Viva',['Abra o endereço do CRM e informe o usuário entregue pela administração.','Digite a senha e clique em Entrar. O login não pede código do autenticador.'],'A sessão abre a visão geral. A senha está oculta no print.');
      await click('Entrar');await expect(page).toHaveURL(/\/$/);
      const login=await api('/v1/auth/totp/inscrever','POST');s.totp=login.dados.segredoBase32;
      await api('/v1/auth/totp/ativar','POST',{codigoTotp:totp(s.totp)});s.totpActivated=Date.now();
      await shot(2,'Reconhecer a visão geral',['Observe os atalhos de captura e agenda.','Use o menu lateral para carteira, funil, propostas e demais módulos.'],'O painel começa vazio nesta base exclusiva de treinamento.');
    });
    await task(2,async()=>{
      await go('/capturar');await shot(3,'Primeiro contato na Tattoo Week',['Exemplo fictício: Marina, do Estúdio Aurora, quer conhecer o portfólio.','Clique em Digitar para registrar o que já sabe; Ler QR usa a câmera.'],'A coleta aceita informações incompletas.','Dados, produto e valores deste guia são fictícios.');
      if(s.local)await go('/contatos/'+s.local);else await click('Digitar');await fill('Nome','Marina — TREINAMENTO');
      await page.waitForTimeout(1600);
      s.local=page.url().split('/').pop();
      await shot(4,'Capturar somente o nome',['Preencha Nome. Não espere receber todos os documentos.','O formulário salva automaticamente; observe o indicador de sincronização.'],'O nome já fica guardado. Não existe campo obrigatório nesta captura.');
      await page.getByText('Contato',{exact:true}).filter({has:page.locator('summary')}).count().catch(()=>0);
      await page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Contato$/})}).locator('summary').click();
      await fill('E-mail','marina@aurora.example.test');
      await page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Observações$/})}).locator('summary').click();
      await fill('Notas','SIMULAÇÃO Tattoo Week. Interesse em portfólio para estúdio. Retornar com apresentação. Nenhum contato real.');
      await page.waitForTimeout(2200);
      await shot(5,'Complementar o contato e o contexto',['Abra Contato e informe o e-mail confirmado com a pessoa.','Em Observações, registre a origem e o interesse, sem dados desnecessários.'],'O cadastro guarda contexto para o próximo atendimento.','O endereço example.test não recebe mensagens reais.');
      await go('/fila');await shot(6,'Conferir a fila de sincronização',['Abra Fila para verificar pendências e falhas.','Aguarde a confirmação; salvar no aparelho e chegar ao servidor são momentos diferentes.'],'O contato desta simulação foi sincronizado.','Sem internet, a captura continua local; os módulos comerciais precisam de conexão.');
      const list=await api('/v1/contatos?limite=100');s.lead=list.dados.find(x=>x.idLocal===s.local)._id;
      await go('/contatos');await shot(7,'Localizar o contato salvo',['Abra Contatos e encontre Marina — TREINAMENTO.','Registros locais e contatos autorizados do servidor podem aparecer na lista.'],'A equipe consegue retomar o cadastro.');
      await go(`/contatos/${s.local}/termo`);await shot(8,'Conferir as autorizações do titular',['Abra Autorizações do titular a partir do contato.','Explique as finalidades; registre apenas a escolha efetiva da pessoa.'],'A tela mostra as escolhas disponíveis; o treinamento não registra consentimento real.','Ter telefone ou e-mail preenchido não comprova autorização para campanha.');
    });
    await task(3,async()=>{
      await go('/lead/'+s.lead);if(await page.getByRole('button',{name:'Marcar como capturado',exact:true}).count())await click('Marcar como capturado');await expect(page.getByText(/está em capturado/)).toBeVisible();
      await shot(9,'Conferir o status capturado',['Gestor ou administrador abre o Lead.','Confira o estado: este cadastro manual já chegou como Capturado. Se estiver em Rascunho, use Marcar como capturado.'],'O contato está capturado e pode ser qualificado.');
      await go('/contatos/'+s.local);await page.getByRole('radio',{name:'Pessoa física',exact:true}).check();await fill('CPF','52998224725');
      await page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Endereço$/})}).locator('summary').click();
      for(const[k,v]of Object.entries({'Logradouro':'Rua Exemplo de Treinamento','Número':'100','Cidade':'São Bernardo do Campo','UF':'SP'}))await fill(k,v);
      await page.waitForTimeout(2500);
      await shot(9.5,'Completar os dados exigidos na promoção',['Antes de qualificar, confirme nome, CPF/CNPJ válido e pelo menos um canal de contato.','Para promover a cliente, complete também logradouro, número, cidade e UF.','Nesta simulação foi usado apenas um CPF de exemplo em base descartável.'],'Os dados necessários são completados depois da captura.','Nunca copie o documento de exemplo para a base real. Não foi feita consulta externa de documento.','Logradouro');
      await go('/lead/'+s.lead);
      await click('Qualificar');await expect(page.getByText(/está em qualificado/)).toBeVisible();
      await shot(10,'Qualificar o interesse comercial',['Confirme se o perfil e a necessidade fazem sentido para a carteira.','Clique em Qualificar; registre o diagnóstico em observações e atividades.'],'O contato fica qualificado e a promoção passa a estar disponível.','Qualificação comercial não substitui autorização de comunicação.');
      await go('/promover/'+s.lead);
      await shot(11,'Promover com confirmação da gestão',['Clique em Promover a cliente no lead qualificado.','Gestor/admin usa o próprio código do autenticador e confirma a promoção.'],'A operação exige TOTP; o login comum continua simples.','A inscrição do autenticador deve ser feita em Minha conta. Nunca compartilhe seu segredo ou código.');
      while(Math.floor(Date.now()/30000)===Math.floor(s.totpActivated/30000))await page.waitForTimeout(1000);
      await fill('Código TOTP obrigatório nesta tela',totp(s.totp));await page.getByRole('button',{name:/^Promover .* a cliente$/}).click();await expect(page.getByText('O contato agora é cliente.')).toBeVisible();
      await page.getByLabel('Código TOTP obrigatório nesta tela').fill('');
      await shot(12,'Confirmar o novo status cliente',['Confira a mensagem O contato agora é cliente.','Na sequência, organize a instituição em Minha carteira.'],'A promoção foi confirmada pelo servidor.','Promover um contato não cria conta comercial, oportunidade ou proposta automaticamente.');
    });
    await task(4,async()=>{
      await go('/carteira?novo=1');
      for(const [k,v]of Object.entries({'Nome da instituição':'Estúdio Aurora — TREINAMENTO','Cidade':'São Bernardo do Campo','UF':'SP','Território':'ABC Paulista','Interlocutor / contato principal':'Marina — TREINAMENTO','E-mail do contato':'marina@aurora.example.test','Próxima ação':'Agendar apresentação do portfólio pós Tattoo Week.','Observações comerciais':'Cenário fictício. Referência ao lead Marina da Tattoo Week. Sem dados ou preços reais.'}))await fill(k,v);
      await select('Segmento','estudio_tatuagem');await select('Classificação da carteira','A');
      await page.getByLabel('Nome da instituição',{exact:true}).scrollIntoViewIfNeeded();
      await shot(13,'Criar a instituição na carteira',['Em Minha carteira, clique em Nova conta.','Preencha instituição, segmento, classificação ABC e território.','Use prospect enquanto ainda está desenvolvendo o relacionamento.'],'O cadastro organiza a instituição e a rotina de visitas.');
      await shot(14,'Definir interlocutor e próxima ação',['Informe o contato principal e os canais conhecidos.','Defina a próxima ação e as observações comerciais.','Clique em Salvar na carteira e aguarde a confirmação.'],'A conta fica disponível para agenda, oportunidade e proposta.','O cadastro da instituição é separado do contato capturado.','Próxima ação');
      s.conta=(await record('contas'))._id;
      await go('/carteira/'+s.conta);
      await shot(15,'Abrir a visão da conta',['Clique no nome da instituição na carteira.','Use os atalhos para agendar visita, criar oportunidade e consultar preços.'],'A ficha reúne o relacionamento e o histórico comercial.');
      await click('Gerenciar contatos');await click('Adicionar contato');
      await fill('Nome do contato 1','Marina — TREINAMENTO');await fill('Cargo do contato 1','Responsável por compras');await fill('E-mail do contato 1','marina@aurora.example.test');
      const checks=page.getByRole('dialog').getByRole('checkbox');
      console.log('CONTATOS_CHECKS',await checks.count());
      if(await checks.count())await checks.first().check();await page.getByRole('radio',{name:'Contato padrão',exact:true}).check();
      await shot(16,'Organizar as pessoas da conta',['Clique em Gerenciar contatos e Adicionar contato.','Informe nome, cargo e e-mail; mantenha o contato ativo e marque o padrão.','Salve para habilitar a seleção de destinatário nas propostas.'],'Marina passa a ser uma pessoa de contato ativa da instituição.');
      await click('Salvar contatos na conta');await expect(page.getByRole('dialog')).toHaveCount(0);
    });
    await task(5,async()=>{
      await go('/carteira/'+s.conta);await click('Gerenciar contatos');await page.getByRole('radio',{name:'Contato padrão',exact:true}).check();await shot(16,'Organizar as pessoas da conta',['Clique em Gerenciar contatos e Adicionar contato.','Informe nome, cargo e e-mail; mantenha o contato ativo e marque Contato padrão.','Salve para habilitar a seleção de destinatário nas propostas.'],'Marina passa a ser uma pessoa de contato ativa e padrão da instituição.');await click('Salvar contatos na conta');await expect(page.getByRole('dialog')).toHaveCount(0);
      if(!s.atividade){
      await go('/agenda?novo=1&contaId='+s.conta);
      await fill('Título da visita ou atividade','Apresentação pós Tattoo Week — Aurora');await fill('Data e horário',date(1)+'T10:00');await fill('Local ou link da reunião','Reunião remota — exemplo de treinamento');await fill('Próxima ação','Apresentar portfólio e confirmar volume de interesse.');await select('Canal','remoto');
      await shot(17,'Planejar a visita ou reunião',['Abra Agenda e crie a atividade vinculada à conta.','Escolha tipo/canal, data e local; atribua responsável e colaboradores quando necessário.','Registre a próxima ação e salve.'],'O compromisso fica planejado na agenda.');
      s.atividade=(await record('atividades'))._id;
      }else await go('/agenda');
      await page.getByRole('button',{name:'Editar Apresentação pós Tattoo Week — Aurora',exact:true}).click();
      await select('Situação','concluida');await fill('Resultado da visita / atividade','Interesse confirmado em 20 kits fictícios. Solicita condição comercial.');await fill('Como a atividade foi realizada','SIMULAÇÃO: apresentação remota, dúvidas de catálogo e confirmação de demanda.');await fill('Próxima ação','Abrir oportunidade e solicitar aprovação do preço.');
      await shot(18,'Registrar a visita realizada',['Edite a atividade e selecione Concluída.','Preencha Resultado, Como a atividade foi realizada e Próxima ação.','Salve: concluir uma atividade registra sua realização.'],'A equipe passa a conhecer o que ocorreu e quem deve agir.','','Resultado da visita / atividade');
      await record('atividades','PATCH',s.atividade);
    });
    await task(6,async()=>{
      await go('/oportunidades?novo=1&contaId='+s.conta);await fill('Nome da oportunidade','Primeiro pedido Aurora — TREINO');await fill('Valor estimado (R$)','1800');await fill('Probabilidade (%)','50');await fill('Previsão de fechamento',date(7));await fill('Próxima ação','Apresentar proposta de 20 kits fictícios.');
      await shot(19,'Abrir a oportunidade de venda',['Crie uma oportunidade ligada à conta.','Informe o valor estimado, a previsão e a próxima ação.','Escolha a etapa que representa o avanço real da negociação.'],'A oportunidade entra no funil com previsão e valor.','R$ 1.800,00 é valor didático, sem tabela comercial real.');
      s.oportunidade=(await record('oportunidades'))._id;
      for(const etapa of ['qualificacao','apresentacao','proposta'])await page.getByLabel('Etapa de Primeiro pedido Aurora — TREINO').selectOption(etapa);
      await shot(20,'Avançar a oportunidade no funil',['No cartão, use o seletor de etapa: Prospecção, Qualificação, Apresentação e Proposta.','Avance após a ação correspondente, sem pular a confirmação com o cliente.'],'O cartão desta simulação chegou à etapa Proposta.','Mudar a etapa não cria uma proposta automaticamente.');
    });
    await task(7,async()=>{
      await go('/produtos?novo=1');await fill('Nome do produto','Kit demonstração — TREINO');await fill('Código / referência','TREINO-001');await select('Categoria','kit');await fill('Fabricante / representada','Catálogo fictício para treinamento');await fill('Preço de referência (R$)','100');await fill('Descrição comercial','Produto fictício para aprender o CRM. Não representa o preço ou a composição dos produtos Pele Rara.');
      await shot(21,'Conferir e manter o catálogo',['Gestor/admin cadastra nome, código, categoria e preço de referência.','O representante consulta o catálogo ao preparar a proposta.','Salve o produto e confira sua apresentação.'],'O item fictício fica disponível no seletor de produtos.','Antes de operar de verdade, use a tabela oficial vigente.');
      s.produto=(await record('produtos'))._id;
      await go('/precos');await click('Solicitar preço');await select('Cliente da negociação',s.conta);await select('Produto negociado',s.produto);await fill('Preço solicitado (R$)','90');await fill('Preço de referência (R$)','100');await fill('Validade da condição',date(10));await fill('Justificativa da solicitação','SIMULAÇÃO: primeiro pedido de 20 unidades, condição didática de 10%.');
      await shot(22,'Solicitar condição comercial por cliente',['Em Preços por cliente, clique em Solicitar preço.','Vincule conta e produto, informe R$ 90,00 e justifique a negociação.','Informe a validade e salve a solicitação.'],'A gestão recebe uma condição comercial para decidir.');
      const buttons=await page.getByRole('dialog').getByRole('button').allTextContents();console.log('PRECO_BUTTONS',buttons);
      await click('Enviar para aprovação');await expect(page.getByRole('dialog')).toHaveCount(0);
      await click('Aprovar');const reason=page.getByRole('dialog').getByRole('textbox');await reason.fill('SIMULAÇÃO: aprovada condição para 20 unidades.');
      await shot(23,'Aprovar o preço com a gestão',['Gestor/admin revisa o pedido e clica em Aprovar.','Registre a observação e confirme a aprovação; Reprovar exige o motivo correspondente.'],'O preço fica aprovado e pode ter o desfecho registrado.','A aprovação não altera automaticamente os itens de uma proposta.');
      await click('Confirmar aprovação');await expect(page.getByRole('dialog')).toHaveCount(0);
    });
    await task(8,async()=>{
      if(!s.proposta){
      await go('/propostas?novo=1&contaId='+s.conta);await fill('Título da proposta','Proposta Aurora — TREINAMENTO');await select('Oportunidade relacionada',s.oportunidade);await fill('Válida até',date(10));await fill('Condições comerciais / pagamento','EXEMPLO DIDÁTICO: pagamento a combinar; 20 unidades a R$ 100,00 com desconto de 10%. Não enviar como oferta real.');await fill('Observações da proposta','SIMULAÇÃO SEM VALIDADE COMERCIAL. Formalização contratual ocorre fora do CRM.');
      await page.getByRole('combobox',{name:'Contato destinatário da proposta',exact:true}).selectOption({index:1});
      await shot(24,'Criar a proposta e seus vínculos',['Em Propostas, crie um novo registro.','Vincule instituição, oportunidade e contato ativo; informe validade.','Preencha condições comerciais e mantenha Rascunho durante a revisão.'],'A proposta mantém o contexto da negociação e o destinatário.');
      await click('Adicionar item');await page.getByRole('combobox',{name:'Produto do catálogo'}).selectOption(s.produto);await fill('Quantidade','20');await fill('Desconto (%)','10');
      await shot(25,'Adicionar itens e conferir o cálculo',['Selecione Kit demonstração — TREINO no catálogo.','Informe 20 unidades a R$ 100,00 e desconto de 10%.','Confira subtotal de R$ 2.000,00, desconto de R$ 200,00 e total de R$ 1.800,00.'],'O valor unitário final equivale aos R$ 90,00 aprovados.','Não aplique desconto novamente sobre o preço já reduzido.','Quantidade');
      const proposta=await record('propostas');s.proposta=proposta._id;if(proposta.totalCentavos!==180000)throw Error('Total da proposta divergente');
      }else {await go('/propostas?editar='+s.proposta);await page.getByRole('combobox',{name:'Contato destinatário da proposta',exact:true}).selectOption({index:1});await shot(24,'Criar a proposta e seus vínculos',['Em Propostas, crie um novo registro.','Vincule instituição e oportunidade; selecione explicitamente Marina em Contato destinatário da proposta.','Informe validade, condições e mantenha Rascunho durante a revisão.'],'A proposta fica ligada ao contato ativo que receberá o rascunho de e-mail.','Mesmo que o nome apareça na impressão, selecione o contato para preparar o e-mail.');await record('propostas','PATCH',s.proposta);}
      await page.getByRole('button',{name:'Abrir Proposta Aurora — TREINAMENTO',exact:true}).click();
      await shot(26,'Revisar a proposta confirmada',['Abra a proposta salva e confira instituição, contato, itens, validade e condições.','O total confirmado vem do servidor.','Use Imprimir proposta para preparar o PDF.'],'A proposta fictícia tem total confirmado de R$ 1.800,00.');
      await page.evaluate(()=>{window.print=()=>{document.body.dataset.trainingPrint='ok'}});await click('Imprimir proposta');await expect(page.locator('body')).toHaveAttribute('data-training-print','ok');await page.emulateMedia({media:'print'});await page.pdf({path:path.join(out,'Proposta-exemplo-SEM-VALIDADE-COMERCIAL.pdf'),format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});
      await click('Abrir rascunho de e-mail');await expect(page.getByRole('status').filter({hasText:/rascunho/i})).toBeVisible();
      await shot(27,'Preparar o e-mail da proposta',['Clique em Abrir rascunho de e-mail.','No aplicativo de e-mail, confira destinatário e texto; anexe manualmente o PDF.','Somente confirme o envio após revisar o conteúdo.'],'O CRM registra a solicitação de rascunho. A simulação não envia e-mail.','Rascunho, PDF e proposta apresentada são registros diferentes; não há anexo automático nem confirmação de entrega.');
    });
    await task(9,async()=>{
      await go('/propostas');await page.getByRole('button',{name:'Editar Proposta Aurora — TREINAMENTO',exact:true}).click();await select('Situação da proposta','apresentada');await record('propostas','PATCH',s.proposta);
      await go('/oportunidades');await page.getByLabel('Etapa de Primeiro pedido Aurora — TREINO').selectOption('negociacao');
      await shot(28,'Registrar apresentação e negociação',['Depois da apresentação efetiva, edite a proposta e marque Apresentada.','No funil, mova a oportunidade para Negociação quando houver ajustes em discussão.'],'A situação de cada registro passa a refletir o atendimento.');
      await go('/propostas');await page.getByRole('button',{name:'Editar Proposta Aurora — TREINAMENTO',exact:true}).click();await select('Situação da proposta','aceita');await record('propostas','PATCH',s.proposta);
      await shot(29,'Registrar o aceite da proposta',['Após receber a confirmação do cliente, edite a proposta e selecione Aceita.','Registre o contexto da confirmação em observações ou atividade.'],'A proposta está aceita no CRM.','Aceita não significa contrato gerado, assinatura realizada ou pedido faturado.');
      await go('/oportunidades');await page.getByLabel('Etapa de Primeiro pedido Aurora — TREINO').selectOption('ganho');
      await shot(30,'Encerrar a oportunidade como ganha',['No funil, marque Ganho após confirmar o fechamento.','Em caso de recusa, use Perdido e registre o motivo na edição.'],'A oportunidade fica ganha e alimenta os indicadores.','A proposta aceita não movimenta o funil automaticamente.');
      await go('/carteira');await page.getByRole('button',{name:'Editar Estúdio Aurora — TREINAMENTO',exact:true}).click();await select('Relacionamento','ativo');await fill('Próxima ação','Formalização externa e acompanhamento da primeira compra.');await record('contas','PATCH',s.conta);
      await go('/precos');await click('Encerrar como ganho');await page.getByRole('dialog').getByRole('textbox').fill('SIMULAÇÃO: cliente aceitou condição final de R$ 90,00 por unidade.');await click('Confirmar ganho');await expect(page.getByRole('dialog')).toHaveCount(0);
      await shot(31,'Concluir a negociação de preço',['Abra o preço aprovado e clique em Encerrar como ganho.','Informe o desfecho; use perdido quando a condição não resultar em fechamento.','Na conta, atualize Relacionamento para Ativo quando aplicável.'],'Preço, oportunidade, proposta e relacionamento foram atualizados separadamente.');
    });
    await task(10,async()=>{
      await go('/agenda?novo=1&contaId='+s.conta);await fill('Título da visita ou atividade','Formalização externa do contrato — TREINO');await select('Tipo de atividade','tarefa');await fill('Data e horário',date(2)+'T14:00');await fill('Próxima ação','Encaminhar proposta aceita ao responsável; formalizar contrato no fluxo externo aprovado.');await fill('Observações','SIMULAÇÃO: não existe emissão, upload ou assinatura de contrato no Tela Viva. Conferir responsáveis, itens, valores, condições e versão final no sistema externo. Não registrar como assinado sem comprovação.');
      await shot(32,'Encaminhar a formalização do contrato',['Crie uma tarefa de formalização externa vinculada à conta.','Defina responsável, prazo e próxima ação.','Depois do retorno, registre o resultado em atividade/observações.'],'O CRM controla o acompanhamento da formalização externa.','Não existe módulo de contratos ou assinatura neste CRM. Esta etapa documenta o encaminhamento, sem contrato fictício.','Observações');
      await record('atividades');
      await go('/agenda?novo=1&contaId='+s.conta);await fill('Título da visita ou atividade','Acompanhamento da primeira compra — TREINO');await select('Tipo de atividade','ligacao');await fill('Data e horário',date(7)+'T10:00');await fill('Próxima ação','Confirmar atendimento, dúvidas e necessidade de nova visita.');await record('atividades');await go('/agenda');
      await shot(33,'Programar o acompanhamento',['Crie uma nova ligação, visita ou tarefa para o retorno.','Defina data e objetivo para o próximo atendimento.'],'A jornada continua após o aceite e a formalização.');
      await go('/');await shot(34,'Conferir o painel após a jornada',['Volte à visão geral e confira carteira, oportunidade ganha e compromissos.','Use os indicadores para organizar o dia e as pendências.'],'Os dados da jornada agora aparecem nos indicadores reais desta base de treino.');
    });
    await task(11,async()=>{
      await go('/treinamentos');await click('Novo treinamento');await fill('Título do treinamento','Apresentação de portfólio Aurora — TREINO');await fill('Início do treinamento',date(3)+'T10:00');await fill('Fim do treinamento',date(3)+'T11:00');await select('Formato do treinamento','online');await select('Conta relacionada',s.conta);await fill('Marca relacionada','Tela Viva — exemplo fictício');await fill('Objetivo / motivo do treinamento','SIMULAÇÃO: apresentar o portfólio e responder dúvidas de atendimento.');
      await shot(35,'Criar um treinamento para a conta',['Em Treinamentos, clique em Novo treinamento.','Informe título, formato, datas, conta e objetivo.','Salve e abra o evento para gerenciar as inscrições.'],'O evento mantém vínculo com o relacionamento comercial.');
      const response=page.waitForResponse(r=>r.url().endsWith('/v1/comercial/treinamentos')&&r.request().method()==='POST');await click('Salvar treinamento');const res=await response;if(!res.ok())throw Error(await res.text());s.treinamento=(await res.json()).registro._id;
      await go('/treinamentos/'+s.treinamento);await click('Abrir inscrições por QR');await click('Gerar QR de inscrição');await expect(page.getByLabel('Link público de inscrição')).toBeVisible();
      await shot(36,'Gerar o QR de inscrição do evento',['Abra Inscrições por QR e gere o link do evento.','Compartilhe o QR do ambiente correto com os participantes.','Um novo token substitui o anterior.'],'O evento ganha um link de inscrição restrito ao treinamento.','Este QR é local e temporário; o celular precisa conseguir acessar o servidor.');
      const link=await page.getByLabel('Link público de inscrição').inputValue();
      const visitor=await context.newPage();await visitor.goto(link);await visitor.getByLabel('Nome para inscrição').fill('Marina — participante fictícia');await visitor.getByLabel('E-mail para inscrição').fill('marina@aurora.example.test');await visitor.getByRole('button',{name:'Registrar minha inscrição'}).click();await expect(visitor.getByRole('heading',{name:'Inscrição registrada.'})).toBeVisible();await visitor.screenshot({path:path.join(out,'prints/37.png')});shots.push({id:37,title:'Simular a inscrição do participante',steps:['A pessoa abre o QR/link e confere o evento.','Preenche nome/e-mail e clica em Registrar minha inscrição.'],result:'A inscrição fictícia foi registrada pelo formulário público.',note:'O mesmo e-mail no mesmo evento não deve criar inscrições duplicadas.',file:'prints/37.png',route:new URL(link).pathname});fs.writeFileSync(path.join(out,'etapas.json'),JSON.stringify(shots,null,2));await visitor.close();
      await go('/treinamentos/'+s.treinamento);await click('Marcar presente');await click('Confirmar alteração');await expect(page.getByText('Presença: registrada',{exact:true})).toBeVisible();
      await shot(38,'Registrar a presença',['Gestor/admin localiza o participante na ficha do evento.','Clique em Marcar presente e confirme a alteração.','Use a inscrição manual para quem não usou o QR.'],'A presença fica registrada e pode compor os relatórios.');
      await click('Exportar participantes');
      await shot(39,'Exportar participantes com proteção',['Gestor/admin escolhe CSV ou XLSX e informa o código do autenticador.','Baixe a lista apenas para a finalidade de trabalho autorizada.'],'A exportação de participantes exige confirmação adicional.','Não compartilhe listas de participantes em canais sem controle.');
    });
    await task(12,async()=>{
      await go('/relatorios');await shot(40,'Consultar relatórios comerciais',['Escolha as datas inicial e final e aplique o período.','A gestão pode filtrar a carteira/representante.','Confira visitas, oportunidades, propostas, treinamentos e inscrições.'],'Os relatórios mostram totais e resultados, sem lista pessoal de participantes.','As datas usam o calendário de São Paulo; a janela máxima é 366 dias.');
      await go('/meu-qr');await click('Gerar QR de autocadastro');await expect(page.getByRole('img',{name:'QR do autocadastro'})).toBeVisible();
      await shot(41,'Oferecer autocadastro pelo Meu QR',['Clique em Gerar QR de autocadastro.','O titular abre o endereço e escolhe as autorizações apresentadas.','Revogue o QR se ele deixar de ser necessário.'],'A alternativa permite que a própria pessoa cadastre seus dados.','Por padrão, o QR de autocadastro vale duas horas e um cadastro. Confira o prazo e o limite configurados no ambiente. Este exemplo usa endereço local.');
      await go('/capturar/qr');await shot(42,'Ler QR com a câmera',['Em Captura, use Ler QR e autorize a câmera do aparelho.','Aponte para o QR e confira os dados antes de continuar.'],'A tela oferece a leitura por câmera.','A captura de câmera física não foi exercitada neste computador; use HTTPS e confira a permissão do navegador.');
      await go('/busca');await shot(43,'Buscar contatos para retomar atendimento',['Abra Busca e pesquise um contato por dado conhecido.','Abra o resultado para consultar o lead e as ações permitidas.'],'A pesquisa consulta os registros acessíveis à sua sessão.');
      await go('/duplicatas');await shot(44,'Revisar possíveis duplicatas',['Confira os pares sugeridos pelo sistema.','Quando houver um par, abra a comparação e escolha os campos antes de confirmar a fusão.'],'A deduplicação oferece revisão humana.','Não foi feita fusão nesta jornada; ela exige escolha explícita e TOTP, com recuperação do absorvido por 90 dias.');
      await go('/planilha');await shot(45,'Importar e exportar contatos por planilha',['Abra Planilha a partir de Minha conta.','Cole CSV ou selecione CSV/XLSX e confira o resultado da importação.','Use a exportação apenas com o perfil e a confirmação exigidos.'],'A tela reúne os recursos de planilha existentes.','O guia não importa a base real nem dispara mensagens. A origem importada não comprova autorização para campanhas.');
      await go('/usuarios');await shot(46,'Administrar os acessos da equipe',['Administrador informa nome, usuário, senha inicial e perfil.','Crie uma conta individual para cada colaborador.','Revise os acessos existentes e confirme operações sensíveis quando solicitado.'],'Cada pessoa trabalha com seu perfil e permissões.','A simulação apenas mostra esta tela; não cria acesso na base da equipe.');
      await go('/minha-conta');await shot(47,'Cuidar da própria sessão',['Use Minha conta para trocar senha, configurar o autenticador e confirmar operações sensíveis.','Ao concluir o trabalho em aparelho compartilhado, clique em Sair.'],'As configurações pessoais ficam separadas da captura.','Nunca fotografe segredo de autenticador, senha ou token.');
      await page.setViewportSize({width:390,height:844});await go('/');await shot(48,'Usar o CRM no celular',['Abra o menu para alternar entre as seções.','Mantenha a captura acessível na rotina de visita.','Confira a conexão antes de salvar registros comerciais.'],'A mesma aplicação oferece navegação móvel.','O modo offline atende captura e fila; carteira e propostas exigem conexão.');await page.setViewportSize({width:1280,height:900});
    });
    await task(13,async()=>{await go('/propostas?editar='+s.proposta);await page.locator('.tv-quote-totals').scrollIntoViewIfNeeded();await shot(25,'Adicionar itens e conferir o cálculo',['Selecione o produto e o contato ativo da conta.','Informe 20 unidades a R$ 100,00 e desconto de 10%.','Confira subtotal de R$ 2.000,00, desconto de R$ 200,00 e total de R$ 1.800,00.'],'O valor unitário final equivale aos R$ 90,00 aprovados.','Não aplique desconto novamente sobre o preço já reduzido.');});
    s.verified={proposal:(await api('/v1/comercial/propostas/'+s.proposta)).registro.totalCentavos,lead:(await api('/v1/contatos/'+s.lead)).dados.status,opportunity:(await api('/v1/comercial/oportunidades/'+s.oportunidade)).registro.etapa};save();
    fs.writeFileSync(path.join(out,'validacao-cenario.json'),JSON.stringify({ambiente:'Cópia da aplicação com Mongo temporário, isolada da base real',prints:shots.length,resultado:s.verified,enviosReais:0,escopoErrosHttp:'Somente a última execução do roteiro; a preparação usou retomadas e correções no roteiro de automação.',errosHttp:apiErrors},null,2));
    console.log('SIMULACAO_CONCLUIDA',JSON.stringify(s.verified));
  }catch(e){await page.screenshot({path:path.join(rt,'falha.png')}).catch(()=>{});fs.writeFileSync(path.join(rt,'falha.txt'),await page.locator('body').innerText());throw e;}
  finally{save();await context.storageState({path:browserFile,indexedDB:true}).catch(()=>{});await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
