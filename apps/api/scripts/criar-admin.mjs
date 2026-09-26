import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import mongoose from 'mongoose';

const scrypt = promisify(scryptCb);
const login = (process.env.ADMIN_LOGIN ?? '').trim().toLowerCase();
const senha = process.env.ADMIN_SENHA ?? '';
const nome = (process.env.ADMIN_NOME ?? 'Erico Henrique de Lima Araujo').trim();
const uri = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/captura7';

if (!login || senha.trim().length < 12) {
  console.error(
    'Defina ADMIN_LOGIN e ADMIN_SENHA com pelo menos 12 caracteres. Nenhum usuário foi criado.',
  );
  process.exit(1);
}

const salt = randomBytes(16);
const hash = await scrypt(senha, salt, 32);
const senhaHash = `scrypt$${salt.toString('base64url')}$${Buffer.from(hash).toString('base64url')}`;

await mongoose.connect(uri);
const usuarios = mongoose.connection.collection('usuarios');
const existente = await usuarios.findOne({ login });
if (existente) {
  console.log(`O login ${login} já existe. A senha não foi trocada.`);
  await mongoose.disconnect();
  process.exit(0);
}
await usuarios.insertOne({
  login,
  senhaHash,
  nome,
  papel: 'admin',
  criadoEm: new Date(),
});
console.log(`Administrador ${login} criado. Entre em /entrar e inscreva o TOTP antes de exportar.`);
await mongoose.disconnect();
