import type { ReactNode } from 'react';

export function limparMarcadores(linha: string): string {
  return linha
    .replace(/^\s*>\s?/, '')
    .replace(/☐/g, '')
    .replace(/\*\*/g, '')
    .trim();
}

export function MarkdownSimples({ texto }: { texto: string }) {
  return <div className="flex flex-col gap-3 text-base">{blocos(texto)}</div>;
}

function blocos(texto: string): ReactNode[] {
  const linhas = texto.replace(/\r\n/g, '\n').split('\n');
  const saida: ReactNode[] = [];
  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i] ?? '';
    if (!linha.trim()) {
      i += 1;
      continue;
    }
    if (linha.trim().startsWith('|')) {
      const tabela: string[] = [];
      while (i < linhas.length && (linhas[i] ?? '').trim().startsWith('|')) {
        tabela.push(linhas[i] ?? '');
        i += 1;
      }
      saida.push(<TabelaMarkdown key={`t-${i}`} linhas={tabela} />);
      continue;
    }
    if (linha.trim().startsWith('>')) {
      const partes: string[] = [];
      while (i < linhas.length && (linhas[i] ?? '').trim().startsWith('>')) {
        partes.push((linhas[i] ?? '').replace(/^\s*>\s?/, ''));
        i += 1;
      }
      saida.push(
        <blockquote key={`q-${i}`} className="border-l-4 border-stone-400 pl-3">
          {inline(partes.join(' '))}
        </blockquote>,
      );
      continue;
    }
    if (/^-\s+/.test(linha.trim())) {
      const itens: string[] = [];
      while (i < linhas.length && /^-\s+/.test((linhas[i] ?? '').trim())) {
        itens.push((linhas[i] ?? '').trim().replace(/^-\s+/, ''));
        i += 1;
      }
      saida.push(
        <ul key={`u-${i}`} className="list-disc pl-5">
          {itens.map((item) => (
            <li key={item}>{inline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (linha.startsWith('## ') || linha.startsWith('# ')) {
      const titulo = linha.startsWith('## ') ? linha.slice(3) : linha.slice(2);
      saida.push(
        <h2 key={`h-${i}`} className="text-xl font-semibold">
          {inline(titulo)}
        </h2>,
      );
      i += 1;
      continue;
    }
    saida.push(<p key={`p-${i}`}>{inline(linha)}</p>);
    i += 1;
  }
  return saida;
}

function TabelaMarkdown({ linhas }: { linhas: string[] }) {
  const celulas = linhas
    .map((linha) =>
      linha
        .split('|')
        .slice(1, -1)
        .map((celula) => celula.trim()),
    )
    .filter((colunas) => colunas.some((celula) => celula && !/^[-: ]+$/.test(celula)));
  const cabeca = celulas[0] ?? [];
  const corpo = celulas.slice(1);
  if (cabeca.length === 0) return null;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr>
          {cabeca.map((celula) => (
            <th key={celula}>{inline(celula)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {corpo.map((linha) => (
          <tr key={linha.join('|')}>
            {linha.map((celula) => (
              <td key={celula}>{inline(celula)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function inline(texto: string): ReactNode[] {
  const limpo = texto.replace(/☐/g, '').trim();
  return limpo
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((parte) =>
      parte.startsWith('**') && parte.endsWith('**') ? (
        <strong key={parte}>{parte.slice(2, -2)}</strong>
      ) : (
        <span key={parte}>{parte}</span>
      ),
    );
}
