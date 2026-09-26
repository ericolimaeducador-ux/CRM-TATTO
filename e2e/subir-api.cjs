const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { MongoMemoryServer } = require('mongodb-memory-server');

const raiz = path.resolve(__dirname, '..');

async function main() {
  const memoria = await MongoMemoryServer.create();
  const filho = spawn(process.execPath, ['apps/api/dist/main.js'], {
    cwd: raiz,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      CAPTURA7_HEADERS_TESTE: '1',
      PORT: '3000',
      MONGO_URI: memoria.getUri(),
      CIFRA_CHAVE_BASE64: randomBytes(32).toString('base64'),
      CIFRA_PEPPER: randomBytes(32).toString('hex'),
    },
  });

  let encerrando = false;
  const encerrar = async (codigo) => {
    if (encerrando) return;
    encerrando = true;
    filho.kill('SIGTERM');
    await memoria.stop();
    process.exit(codigo);
  };

  filho.on('exit', (codigo) => {
    if (!encerrando) void encerrar(codigo ?? 1);
  });
  process.on('SIGTERM', () => void encerrar(0));
  process.on('SIGINT', () => void encerrar(0));
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
