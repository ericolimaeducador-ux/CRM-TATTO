import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exigirApi = createRequire(join(process.cwd(), 'apps/api/package.json'));
const { MongoMemoryServer } = exigirApi('mongodb-memory-server');
const { MongoClient, ObjectId } = exigirPacote('mongodb');
const { EJSON } = exigirPacote('bson');

function exigirPacote(nome) {
  const raiz = join(process.cwd(), 'node_modules/.pnpm');
  const versao = readdirSync(raiz)
    .filter((item) => item.startsWith(`${nome}@`))
    .sort()
    .at(-1);
  if (!versao) throw new Error(`${nome} não está instalado. Rode pnpm install na raiz.`);
  return createRequire(join(raiz, versao, 'node_modules', nome, 'package.json'))(nome);
}

const diretoria = process.env.BACKUP_DIR?.trim() || join(tmpdir(), 'captura7-backup-321');
const arquivo = join(diretoria, 'captura7.backup');

const relogio = {
  rpoMs: 0,
  rtoMs: 0,
};

try {
  const medicao = await medir();
  process.stdout.write(`${JSON.stringify(medicao, null, 2)}\n`);
  if (!medicao.amostraAuditoriaOk || !medicao.contagensIguais) process.exitCode = 1;
} catch (erro) {
  const mensagem = erro instanceof Error ? erro.message : 'falha';
  process.stderr.write(`${JSON.stringify({ nivel: 'ERROR', evento: 'backup_321', mensagem })}\n`);
  process.exitCode = 1;
}

async function medir() {
  const chave = lerChave();
  const origem = await abrirOrigem();
  try {
    const escritoEm = await semearSeMemoria(origem);
    const tEscrita = escritoEm ?? Date.now();
    const pacote = await exportar(origem.db);
    const cifrado = cifrar(EJSON.stringify(pacote), chave.bytes);
    await mkdir(diretoria, { recursive: true });
    await writeFile(arquivo, cifrado);
    relogio.rpoMs = Date.now() - tEscrita;
    const remoto = await copiarRemoto(arquivo);
    const limpa = await MongoMemoryServer.create();
    const clienteLimpo = new MongoClient(limpa.getUri());
    await clienteLimpo.connect();
    try {
      const inicioRestaure = Date.now();
      const restaurado = await restaurar(clienteLimpo.db('captura7'), chave.bytes);
      const amostraOk = amostraConfere(pacote, restaurado);
      relogio.rtoMs = Date.now() - inicioRestaure;
      return {
        rpoMs: relogio.rpoMs,
        rtoMs: relogio.rtoMs,
        contagensOrigem: contar(pacote),
        contagensRestauradas: contar(restaurado),
        contagensIguais: JSON.stringify(contar(pacote)) === JSON.stringify(contar(restaurado)),
        amostraAuditoriaOk: amostraOk,
        copiaLocalCifrada: true,
        segundaMidiaFisica: false,
        destinoExterno: remoto.enviado,
        regra321: 'nao_atendida',
        chaveSoNestaExecucao: chave.efemera,
        faltando: remoto.faltando,
      };
    } finally {
      await clienteLimpo.close();
      await limpa.stop();
    }
  } finally {
    await origem.fechar();
  }
}

async function abrirOrigem() {
  const uri = process.env.MONGO_URI?.trim();
  if (uri && !uri.includes('preencha-com')) {
    const cliente = new MongoClient(uri);
    await cliente.connect();
    return {
      db: cliente.db(),
      semear: false,
      fechar: async () => {
        await cliente.close();
      },
    };
  }
  const memoria = await MongoMemoryServer.create();
  const cliente = new MongoClient(memoria.getUri());
  await cliente.connect();
  return {
    db: cliente.db('captura7'),
    semear: true,
    fechar: async () => {
      await cliente.close();
      await memoria.stop();
    },
  };
}

async function semearSeMemoria(origem) {
  if (!origem.semear) {
    const ultima = await origem.db
      .collection('contatos_auditoria')
      .find({}, { projection: { timestampServidor: 1 } })
      .sort({ timestampServidor: -1 })
      .limit(1)
      .next();
    const marca = ultima?.timestampServidor;
    return marca instanceof Date ? marca.getTime() : Date.now();
  }
  const contatoId = new ObjectId();
  const escritoEm = new Date();
  await origem.db.collection('contatos').insertOne({
    _id: contatoId,
    nome: 'Amostra de medição',
    status: 'capturado',
    versao: 1,
  });
  await origem.db.collection('contatos_auditoria').insertOne({
    contatoId,
    campo: 'status',
    valorAnterior: 'rascunho',
    valorNovo: 'capturado',
    autor: 'medicao',
    origem: 'api',
    timestampServidor: escritoEm,
  });
  return escritoEm.getTime();
}

async function exportar(db) {
  const nomes = (await db.listCollections().toArray()).map((item) => item.name);
  const pacote = {};
  for (const nome of nomes) {
    pacote[nome] = await db.collection(nome).find().toArray();
  }
  return pacote;
}

async function restaurar(db, chave) {
  const bruto = await readFile(arquivo);
  const pacote = EJSON.parse(decifrar(bruto, chave));
  for (const [nome, docs] of Object.entries(pacote)) {
    if (docs.length === 0) continue;
    await db.collection(nome).insertMany(docs);
  }
  return pacote;
}

function amostraConfere(origem, restaurado) {
  const trilha = origem.contatos_auditoria ?? [];
  const volta = restaurado.contatos_auditoria ?? [];
  if (trilha.length !== volta.length || trilha.length === 0) return trilha.length === volta.length;
  const antes = trilha[0];
  const depois = volta.find((item) => String(item.contatoId) === String(antes.contatoId));
  if (!depois) return false;
  return (
    depois.campo === antes.campo &&
    depois.valorAnterior === antes.valorAnterior &&
    depois.valorNovo === antes.valorNovo
  );
}

function contar(pacote) {
  return Object.fromEntries(Object.entries(pacote).map(([nome, docs]) => [nome, docs.length]));
}

async function copiarRemoto(caminhoLocal) {
  const destino = process.env.BACKUP_REMOTO_DESTINO?.trim() ?? '';
  if (!destino || destino.includes('preencha-com')) {
    return {
      enviado: false,
      faltando:
        'Conta de object storage do dono. Defina BACKUP_REMOTO_DESTINO com a URL do bucket (s3:// ou b2://) e a credencial fora do repositório. Este script não envia enquanto isso não existir.',
    };
  }
  if (destino.startsWith('s3://') || destino.startsWith('b2://')) {
    return {
      enviado: false,
      faltando: `Destino ${destino} informado, sem credencial de upload neste ambiente. O arquivo cifrado ficou só em ${caminhoLocal}.`,
    };
  }
  return {
    enviado: false,
    faltando:
      'BACKUP_REMOTO_DESTINO não é object storage. Cópia para outro diretório da mesma máquina não conta como fora do local.',
  };
}

function lerChave() {
  const bruto = process.env.BACKUP_CHAVE?.trim() ?? '';
  if (!bruto || bruto.includes('preencha-com')) {
    return { bytes: randomBytes(32), efemera: true };
  }
  const bytes = Buffer.from(bruto, 'base64');
  if (bytes.length !== 32) {
    throw new Error('BACKUP_CHAVE precisa decodificar para 32 bytes.');
  }
  return { bytes, efemera: false };
}

function cifrar(texto, chave) {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chave, iv);
  const corpo = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
  return Buffer.concat([iv, cifra.getAuthTag(), corpo]);
}

function decifrar(pacote, chave) {
  const iv = pacote.subarray(0, 12);
  const tag = pacote.subarray(12, 28);
  const corpo = pacote.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', chave, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(corpo), decipher.final()]).toString('utf8');
}
