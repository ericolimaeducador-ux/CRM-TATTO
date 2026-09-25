const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

if (!existsSync('migrations/cli.ts')) {
  console.log(
    JSON.stringify({
      nivel: 'INFO',
      evento: 'migracao_ausente',
      mensagem: 'Nenhuma migração para aplicar.',
    }),
  );
  process.exit(0);
}

const resultado = spawnSync(
  'pnpm',
  ['exec', 'ts-node', '--transpile-only', '-P', 'tsconfig.json', 'migrations/cli.ts'],
  { stdio: 'inherit' },
);

process.exit(resultado.status ?? 1);
