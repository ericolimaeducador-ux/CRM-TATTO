const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function run(file, args, cwd, env = process.env) {
  const result = spawnSync(process.execPath, [path.join(root, file), ...args], {
    cwd: path.join(root, cwd),
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Isolated API/database: the user's Docker API on port 3000 is never used.
run('apps/api/node_modules/@nestjs/cli/bin/nest.js', ['build'], 'apps/api');
run('node_modules/typescript/bin/tsc', ['-p', 'tsconfig.json', '--noEmit'], 'apps/web');
run('apps/web/node_modules/vite/bin/vite.js', ['build'], 'apps/web', {
  ...process.env,
  VITE_CAPTURA7_HEADERS_TESTE: '1',
  VITE_API_URL: 'http://127.0.0.1:3101',
});
run(
  'node_modules/@playwright/test/cli.js',
  ['test', '-c', 'e2e/playwright.config.ts', ...process.argv.slice(2)],
  '.',
);
