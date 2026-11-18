/* Exporta o vetor oficial sem alterar desenho, proporção, tipografia ou slogan. */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artes', 'camiseta');
const fonte = (nome) => fs.readFileSync(path.join(root, 'apps', 'web', 'public', 'fonts', nome)).toString('base64');
const original = fs.readFileSync(path.join(out, 'tela-viva-original-claro.svg'), 'utf8').replace(/^\uFEFF/, '');
const css = `<defs><style type="text/css">
@font-face { font-family: 'Playfair Display'; font-style: normal; font-weight: 400; src: url('data:font/woff2;base64,${fonte('playfair-display-latin-400-normal.woff2')}') format('woff2'); }
@font-face { font-family: 'Inter'; font-style: normal; font-weight: 400; src: url('data:font/woff2;base64,${fonte('inter-latin-400-normal.woff2')}') format('woff2'); }
</style></defs>`;
const svg = original.replace(/(<svg\b[^>]*>)/, `$1\n${css}`);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'tela-viva-costas-branco-transparente.svg'), svg, 'utf8');

// pHYs: 20.000 pixels por metro = 508 dpi. 6000 px correspondem a 30 cm.
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
function comDensidade(png, pixelsPorMetro = 20000) {
  const type = Buffer.from('pHYs'); const dados = Buffer.alloc(9);
  dados.writeUInt32BE(pixelsPorMetro, 0); dados.writeUInt32BE(pixelsPorMetro, 4); dados[8] = 1;
  const chunk = Buffer.alloc(21); chunk.writeUInt32BE(9, 0); type.copy(chunk, 4); dados.copy(chunk, 8); chunk.writeUInt32BE(crc32(Buffer.concat([type, dados])), 17);
  const blocos = [png.subarray(0, 8)]; let pos = 8; let inserido = false;
  while (pos < png.length) { const len = png.readUInt32BE(pos); const fim = pos + len + 12; const tipo = png.toString('ascii', pos + 4, pos + 8); if (tipo !== 'pHYs') blocos.push(png.subarray(pos, fim)); if (tipo === 'IHDR' && !inserido) { blocos.push(chunk); inserido = true; } pos = fim; }
  return Buffer.concat(blocos);
}
async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 6000, height: 1800 }, deviceScaleFactor: 1 });
    const montar = async (largura, altura, fundo) => {
      await page.setViewportSize({ width: largura, height: altura });
      await page.setContent(`<html><head><meta charset="utf-8"/><style>html,body{margin:0;width:${largura}px;height:${altura}px;background:${fundo};overflow:hidden}svg{display:block;width:${largura}px;height:${altura}px}</style></head><body>${svg}</body></html>`);
      await page.evaluate(async () => { await document.fonts.ready; await document.fonts.load('400 190px "Playfair Display"', 'TELA VIVA'); await document.fonts.load('400 42px Inter', 'CUIDADOS PARA PELE TATUADA'); });
      const fontesOk = await page.evaluate(() => document.fonts.check('400 190px "Playfair Display"') && document.fonts.check('400 42px Inter'));
      if (!fontesOk) throw new Error('As fontes oficiais não terminaram de carregar.');
    };
    await montar(6000, 1800, 'transparent');
    const png = await page.screenshot({ type: 'png', omitBackground: true, animations: 'disabled' });
    if (png.readUInt32BE(16) !== 6000 || png.readUInt32BE(20) !== 1800 || png[25] !== 6) throw new Error('PNG precisa de 6000x1800 com canal alfa.');
    fs.writeFileSync(path.join(out, 'tela-viva-costas-transparente-6000x1800.png'), comDensidade(png));
    await montar(1000, 300, '#111111');
    await page.screenshot({ path: path.join(out, 'tela-viva-camiseta-preta-preview.png'), type: 'png', animations: 'disabled' });
    const resumo = { original: 'telaviva-lockup-claro.svg', proporcao: '1400:420', cor: '#FBF7F1', fontes: ['Playfair Display 400', 'Inter 400'], png: { largura: 6000, altura: 1800, canalAlfa: true, dpi: 508, impressaoCm: [30, 9] }, preview: { largura: 1000, altura: 300, fundo: '#111111' } };
    fs.writeFileSync(path.join(out, 'exportacao.json'), JSON.stringify(resumo, null, 2) + '\n');
    process.stdout.write('SVG e PNG transparente exportados; preview preto disponível em artes/camiseta.\n');
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
