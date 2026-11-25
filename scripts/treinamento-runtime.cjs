// Ambiente descartável de treinamento. Nunca usa o Mongo configurado no .env.
const { createRequire } = require('node:module');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const requireApi = createRequire(path.join(root, 'apps/api/package.json'));
const { MongoMemoryServer } = requireApi('mongodb-memory-server');
const runtime = path.join(root, 'test-results/treinamento-runtime');
fs.mkdirSync(runtime, { recursive: true });
const children = [];
function child(args, env, logfile) {
  const fd = fs.openSync(path.join(runtime, logfile), 'w');
  const p = spawn(process.execPath, args, { cwd: root, env: {...process.env, ...env}, stdio: ['ignore', fd, fd], windowsHide: true });
  children.push(p);
  return p;
}
async function wait(url) {
  for (let i=0;i<120;i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise(r=>setTimeout(r,500)); }
  throw Error('Serviço indisponível: '+url);
}
async function main() {
  // Artefatos privados da execução anterior não servem para o novo banco temporário.
  for (const name of ['acesso.json','browser.json','cenario.json']) fs.rmSync(path.join(runtime,name),{force:true});
  const memory = await MongoMemoryServer.create({instance:{dbName:'telaviva_treinamento'}});
  const close = async () => { for (const p of children) p.kill(); await memory.stop(); for (const name of ['acesso.json','browser.json','cenario.json']) fs.rmSync(path.join(runtime,name),{force:true}); process.exit(0); };
  process.on('SIGINT', close); process.on('SIGTERM', close);
  child(['apps/api/dist/main.js'], {
    NODE_ENV:'test', CAPTURA7_HEADERS_TESTE:'1', PORT:'3101', MONGO_URI:memory.getUri(),
    SEGREDOS_ARQUIVO:'', ERP_WEBHOOK_URL:'', ERP_WEBHOOK_SEGREDO:'', SHEETS_PLANILHA_ID:'', SHEETS_TOKEN:'', SHEETS_RESPONSAVEL_ID:'', SHEETS_ABA:'',
    WHATSAPP_ENVIO_ATIVO:'false', WHATSAPP_ACCESS_TOKEN:'', WHATSAPP_TOKEN:'', WHATSAPP_PHONE_NUMBER_ID:'',
    CAPTCHA_PROVEDOR:'local', CIFRA_CHAVE_BASE64:randomBytes(32).toString('base64'), CIFRA_PEPPER:randomBytes(32).toString('hex'),
  }, 'api.log');
  await wait('http://127.0.0.1:3101/v1/saude');
  const senha = randomBytes(20).toString('hex');
  const r = await fetch('http://127.0.0.1:3101/v1/usuarios',{method:'POST', headers:{'content-type':'application/json','x-papel-teste':'admin','x-usuario-id':'507f1f77bcf86cd799439088'},body:JSON.stringify({login:'equipe.treinamento',nome:'Equipe de Treinamento',senha,papel:'admin'})});
  if(!r.ok) throw Error('Não criou administrador isolado: '+await r.text());
  fs.writeFileSync(path.join(runtime,'acesso.json'),JSON.stringify({login:'equipe.treinamento',senha}));
  child(['apps/web/node_modules/vite/bin/vite.js','preview','apps/web','--outDir',path.join(runtime,'web'),'--host','127.0.0.1','--port','4173','--strictPort'],{CAPTURA7_API_PROXY:'http://127.0.0.1:3101'},'web.log');
  await wait('http://127.0.0.1:4173');
  console.log('TREINAMENTO_PRONTO: http://127.0.0.1:4173 — base temporária isolada, login regular.');
  setInterval(()=>{},30000);
}
main().catch(e=>{console.error(e.message);for(const p of children)p.kill();process.exit(1)});
