import { deflateRawSync, inflateRawSync } from 'node:zlib';

const TABELA = montarTabela();

export interface ArquivoZip {
  nome: string;
  conteudo: Buffer;
}

export function zipar(arquivos: ArquivoZip[]): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let offset = 0;
  for (const arquivo of arquivos) {
    const nome = Buffer.from(arquivo.nome, 'utf8');
    const cru = arquivo.conteudo;
    const conteudo = deflateRawSync(cru);
    const crc = crc32(cru);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(conteudo.length, 18);
    local.writeUInt32LE(cru.length, 22);
    local.writeUInt16LE(nome.length, 26);
    const pedaco = Buffer.concat([local, nome, conteudo]);
    locais.push(pedaco);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(conteudo.length, 20);
    central.writeUInt32LE(cru.length, 24);
    central.writeUInt16LE(nome.length, 28);
    central.writeUInt32LE(offset, 42);
    centrais.push(Buffer.concat([central, nome]));
    offset += pedaco.length;
  }
  const corpo = Buffer.concat(locais);
  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(corpo.length, 16);
  return Buffer.concat([corpo, diretorio, fim]);
}

export function lerZip(pacote: Buffer): Map<string, Buffer> {
  const saida = new Map<string, Buffer>();
  let cursor = 0;
  while (cursor + 30 <= pacote.length && pacote.readUInt32LE(cursor) === 0x04034b50) {
    const flags = pacote.readUInt16LE(cursor + 6);
    if (flags & 0x0008) {
      throw new Error('ZIP com descritor de dados. Exporte a planilha como CSV.');
    }
    const metodo = pacote.readUInt16LE(cursor + 8);
    const comprimido = pacote.readUInt32LE(cursor + 18);
    const nomeTam = pacote.readUInt16LE(cursor + 26);
    const extra = pacote.readUInt16LE(cursor + 28);
    const inicioNome = cursor + 30;
    const nome = pacote.subarray(inicioNome, inicioNome + nomeTam).toString('utf8');
    const inicio = inicioNome + nomeTam + extra;
    const dados = pacote.subarray(inicio, inicio + comprimido);
    saida.set(nome, metodo === 0 ? Buffer.from(dados) : inflateRawSync(dados));
    cursor = inicio + comprimido;
  }
  return saida;
}

function crc32(dados: Buffer): number {
  let c = 0xffffffff;
  for (const byte of dados) c = TABELA[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function montarTabela(): Uint32Array {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
}
