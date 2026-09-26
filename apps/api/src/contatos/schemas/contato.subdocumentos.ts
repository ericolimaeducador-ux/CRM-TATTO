import { Schema } from 'mongoose';

export const emailSchema = new Schema(
  {
    valor: { type: String },
    tipo: { type: String, enum: ['pessoal', 'comercial'] },
    principal: { type: Boolean },
  },
  { _id: false },
);

export const telefoneSchema = new Schema(
  {
    e164: { type: String },
    bruto: { type: String },
    tipo: { type: String, enum: ['celular', 'fixo', 'comercial'] },
    whatsapp: { type: Boolean },
    principal: { type: Boolean },
  },
  { _id: false },
);

export const enderecoSchema = new Schema(
  {
    cep: { type: String },
    logradouro: { type: String },
    numero: { type: String },
    complemento: { type: String },
    bairro: { type: String },
    cidade: { type: String },
    uf: { type: String },
    tipo: { type: String, enum: ['comercial', 'entrega', 'cobranca', 'residencial'] },
    principal: { type: Boolean },
  },
  { _id: false },
);

export const pfSchema = new Schema(
  {
    cpfCifrado: { type: String },
    cpfHash: { type: String },
    cpfMascarado: { type: String },
    rg: { type: String },
    dataNascimento: { type: Date },
    sexo: { type: String, enum: ['F', 'M', 'outro', 'nao_informado'] },
    profissao: { type: String },
    conselho: {
      type: new Schema(
        {
          sigla: { type: String, enum: ['COREN', 'CRM', 'CRF', 'CRO', 'CREFITO', 'outro'] },
          numero: { type: String },
          uf: { type: String },
        },
        { _id: false },
      ),
    },
  },
  { _id: false },
);

const pessoaContatoSchema = new Schema(
  {
    nome: { type: String },
    cargo: { type: String },
    email: { type: String },
    telefone: { type: String },
    decisor: { type: Boolean },
  },
  { _id: false },
);

export const pjSchema = new Schema(
  {
    cnpjCifrado: { type: String },
    cnpjHash: { type: String },
    cnpjMascarado: { type: String },
    cnpjRaiz: { type: String },
    razaoSocial: { type: String },
    nomeFantasia: { type: String },
    inscricaoEstadual: { type: String },
    inscricaoMunicipal: { type: String },
    cnaePrincipal: {
      type: new Schema({ codigo: { type: String }, descricao: { type: String } }, { _id: false }),
    },
    cnaesSecundarios: {
      type: [new Schema({ codigo: { type: String }, descricao: { type: String } }, { _id: false })],
    },
    naturezaJuridica: { type: String },
    porte: { type: String, enum: ['MEI', 'ME', 'EPP', 'DEMAIS'] },
    situacaoCadastral: { type: String },
    dataAbertura: { type: Date },
    capitalSocial: { type: Number },
    responsavelTecnico: {
      type: new Schema(
        {
          nome: { type: String },
          conselho: { type: String },
          numero: { type: String },
          uf: { type: String },
        },
        { _id: false },
      ),
    },
    contatos: { type: [pessoaContatoSchema] },
  },
  { _id: false },
);

const consentimentoSchema = new Schema(
  {
    finalidade: { type: String, enum: ['contato_comercial', 'envio_erp'] },
    emDispositivo: { type: Date },
    emServidor: { type: Date },
    versaoTermo: { type: String },
    hashTexto: { type: String },
    canal: { type: String, enum: ['vendedor_evento', 'autocadastro'] },
    responsavelId: { type: Schema.Types.ObjectId },
    revogadoEm: { type: Date },
  },
  { _id: false },
);

export const lgpdSchema = new Schema(
  {
    baseLegal: {
      type: String,
      enum: ['consentimento', 'legitimo_interesse', 'execucao_contrato'],
      default: 'legitimo_interesse',
    },
    finalidade: { type: [String], default: () => ['prospecção comercial B2B'] },
    canalColeta: { type: String, default: 'manual' },
    consentimentoEm: { type: Date },
    consentimentoTexto: { type: String },
    versaoTermo: { type: String },
    ipConsentimento: { type: String },
    revogadoEm: { type: Date },
    purgadoEm: { type: Date },
    contatoComercial: {
      type: String,
      enum: ['pendente', 'concedido', 'revogado'],
      default: 'pendente',
    },
    consentimentos: { type: [consentimentoSchema], default: () => [] },
    eliminadoEm: { type: Date },
  },
  { _id: false },
);

export const origemSchema = new Schema(
  {
    modo: {
      type: String,
      enum: ['qr_lido', 'qr_proprio', 'manual', 'google_forms', 'importacao', 'importado'],
      default: 'manual',
    },
    capturadoPor: { type: Schema.Types.ObjectId },
    vendedorAtribuido: { type: Schema.Types.ObjectId },
    dispositivo: { type: String },
    capturadoEmDispositivo: { type: Date },
    geo: {
      type: new Schema(
        {
          lat: { type: Number },
          lng: { type: Number },
          precisao: { type: Number },
        },
        { _id: false },
      ),
    },
    evento: { type: String },
    payloadBruto: { type: String },
    enriquecimentoBruto: {
      type: [
        new Schema(
          {
            fonte: { type: String },
            payload: { type: Schema.Types.Mixed },
            em: { type: Date },
          },
          { _id: false },
        ),
      ],
    },
  },
  { _id: false },
);
