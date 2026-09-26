import { lerZip, zipar } from './zip';

export function paraCsv(linhas: string[][]): string {
  return `${linhas.map((linha) => linha.map(celulaCsv).join(',')).join('\n')}\n`;
}

export function lerCsv(texto: string): string[][] {
  const limpo = texto.replace(/^\uFEFF/, '');
  const linhas: string[][] = [];
  let atual: string[] = [];
  let celula = '';
  let aspas = false;
  for (let i = 0; i < limpo.length; i += 1) {
    const char = limpo[i];
    if (aspas) {
      if (char === '"') {
        if (limpo[i + 1] === '"') {
          celula += '"';
          i += 1;
        } else aspas = false;
      } else celula += char;
      continue;
    }
    if (char === '"') aspas = true;
    else if (char === ',') {
      atual.push(celula);
      celula = '';
    } else if (char === '\n') {
      atual.push(celula.replace(/\r$/, ''));
      if (atual.some((item) => item.trim())) linhas.push(atual);
      atual = [];
      celula = '';
    } else celula += char;
  }
  atual.push(celula.replace(/\r$/, ''));
  if (atual.some((item) => item.trim())) linhas.push(atual);
  return linhas;
}

export function paraXlsx(linhas: string[][]): Buffer {
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${linhas
    .map((linha, indice) => {
      const celulas = linha
        .map(
          (valor, coluna) =>
            `<c r="${nomeColuna(coluna)}${indice + 1}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`,
        )
        .join('');
      return `<row r="${indice + 1}">${celulas}</row>`;
    })
    .join('')}</sheetData></worksheet>`;
  return zipar([
    {
      nome: '[Content_Types].xml',
      conteudo: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
      ),
    },
    {
      nome: '_rels/.rels',
      conteudo: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
      ),
    },
    {
      nome: 'xl/workbook.xml',
      conteudo: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Leads" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      nome: 'xl/_rels/workbook.xml.rels',
      conteudo: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
      ),
    },
    { nome: 'xl/worksheets/sheet1.xml', conteudo: Buffer.from(sheet) },
  ]);
}

export function matrizDoXlsx(pacote: Buffer): string[][] {
  const arquivos = lerZip(pacote);
  const sheet = arquivos.get('xl/worksheets/sheet1.xml')?.toString('utf8');
  if (!sheet) throw new Error('A planilha não tem a primeira aba. Use CSV.');
  const textos = textosCompartilhados(arquivos.get('xl/sharedStrings.xml')?.toString('utf8') ?? '');
  const linhas: string[][] = [];
  for (const row of sheet.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const linha: string[] = [];
    for (const celula of row.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = /r="([A-Z]+)/.exec(celula[1])?.[1] ?? 'A';
      const indice = indiceColuna(ref);
      while (linha.length < indice) linha.push('');
      linha[indice] = valorCelula(/t="([^"]+)"/.exec(celula[1])?.[1] ?? '', celula[2], textos);
    }
    if (linha.some((item) => item.trim())) linhas.push(linha);
  }
  return linhas;
}

function textosCompartilhados(xml: string): string[] {
  return [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) => desescaparXml(item[1]));
}

function valorCelula(tipo: string, miolo: string, textos: string[]): string {
  if (tipo === 'inlineStr') return desescaparXml(/<t[^>]*>([\s\S]*?)<\/t>/.exec(miolo)?.[1] ?? '');
  const bruto = /<v>([\s\S]*?)<\/v>/.exec(miolo)?.[1] ?? '';
  if (tipo === 's') return textos[Number(bruto)] ?? '';
  return desescaparXml(bruto);
}

function celulaCsv(valor: string): string {
  let texto = valor ?? '';
  if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
  if (/[",\n\r]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

function escaparXml(valor: string): string {
  return valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function desescaparXml(valor: string): string {
  return valor.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function nomeColuna(indice: number): string {
  let n = indice + 1;
  let nome = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    nome = String.fromCharCode(65 + resto) + nome;
    n = Math.floor((n - 1) / 26);
  }
  return nome;
}

function indiceColuna(nome: string): number {
  let n = 0;
  for (const char of nome) n = n * 26 + (char.charCodeAt(0) - 64);
  return n - 1;
}
