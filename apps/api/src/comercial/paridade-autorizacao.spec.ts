import { ComercialService } from './comercial.service';

describe('TV-15 — privacidade dos participantes sem dependência de banco', () => {
  function contexto() {
    const participante = {
      _id: '507f1f77bcf86cd799439071',
      tipo: 'participantes',
      donoId: '507f1f77bcf86cd799439072',
      campos: { nome: 'Pessoa QA', email: 'privado@exemplo.test', telefone: '11900000000' },
      versao: 1,
      arquivado: false,
      auditoria: [],
    };
    const lista = {
      select: jest.fn(),
      sort: jest.fn(),
      skip: jest.fn(),
      limit: jest.fn(),
      lean: jest.fn(async () => [participante]),
    };
    for (const metodo of ['select', 'sort', 'skip', 'limit'] as const)
      lista[metodo].mockReturnValue(lista);
    const modelo = {
      find: jest.fn(() => lista),
      countDocuments: jest.fn(async () => 1),
      findOne: jest.fn(() => ({ lean: async () => participante })),
    };
    const conexao = { collection: jest.fn(() => ({ insertOne: jest.fn(async () => ({})) })) };
    const service = new ComercialService(modelo as never, conexao as never);
    const auditor = {
      id: '507f1f77bcf86cd799439073',
      papel: 'auditor',
      nome: 'QA auditor',
      stepUp: false,
    };
    return { service, auditor, participante };
  }

  it('nega a listagem nominal de participantes para o papel auditor', async () => {
    const { service, auditor } = contexto();
    await expect(service.listar('participantes', {}, auditor)).rejects.toMatchObject({
      statusHttp: 403,
    });
  });

  it('nega a consulta individual de participante para o papel auditor', async () => {
    const { service, auditor, participante } = contexto();
    await expect(service.obter('participantes', participante._id, auditor)).rejects.toMatchObject({
      statusHttp: 403,
    });
  });
});
