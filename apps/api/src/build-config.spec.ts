import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// O Render guarda cache entre deploys. Com build incremental, um tsbuildinfo antigo fazia o
// `nest build` achar que nada mudou e publicar o dist velho.
describe('build de produção', () => {
  const raiz = join(__dirname, '..');

  it('compila do zero: sem incremental e limpando o dist antes', () => {
    const build = JSON.parse(readFileSync(join(raiz, 'tsconfig.build.json'), 'utf8')) as {
      compilerOptions?: { incremental?: boolean };
    };
    expect(build.compilerOptions?.incremental).toBe(false);
    const nest = JSON.parse(readFileSync(join(raiz, 'nest-cli.json'), 'utf8')) as {
      compilerOptions?: { deleteOutDir?: boolean };
    };
    expect(nest.compilerOptions?.deleteOutDir).toBe(true);
  });
});
