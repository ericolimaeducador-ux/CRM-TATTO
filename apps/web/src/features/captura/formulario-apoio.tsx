import type { UseFormRegisterReturn } from 'react-hook-form';
import { lerUm, salvarCampo } from '@/lib/offline/fila';
import type { ContatoLocal } from '@/lib/offline/tipos';

export interface Campos {
  nome: string;
  tipoPessoa: string;
  telefone: string;
  email: string;
  cpf: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  cep: string;
  logradouro: string;
  numero: string;
  cidade: string;
  uf: string;
  observacoes: string;
}

export const VAZIO: Campos = {
  nome: '',
  tipoPessoa: 'INDEFINIDO',
  telefone: '',
  email: '',
  cpf: '',
  cnpj: '',
  razaoSocial: '',
  nomeFantasia: '',
  cep: '',
  logradouro: '',
  numero: '',
  cidade: '',
  uf: '',
  observacoes: '',
};

export async function gravarCampos(
  idLocal: string,
  atuais: Campos,
  ultimo: { current: Record<string, string> },
  valoresRef: { current: Campos },
  definir: (contato: ContatoLocal) => void,
): Promise<void> {
  const alterados = (Object.keys(VAZIO) as (keyof Campos)[]).filter(
    (campo) => atuais[campo] !== ultimo.current[campo],
  );
  if (alterados.length === 0) return;
  const existente = await lerUm(idLocal);
  const uteis = alterados.filter((campo) => campoUtil(campo, atuais[campo], Boolean(existente)));
  for (const campo of alterados) ultimo.current[campo] = atuais[campo];
  if (uteis.length === 0) return;
  const foto = JSON.stringify(atuais);
  for (const campo of uteis) definir(await salvarCampo(idLocal, campo, atuais[campo]));
  if (JSON.stringify(valoresRef.current) === foto) limparPendenteSeIgual(idLocal, foto);
}

function campoUtil(campo: keyof Campos, valor: string, jaExiste: boolean): boolean {
  if (jaExiste) return true;
  if (campo === 'tipoPessoa') return valor === 'PF' || valor === 'PJ';
  return valor.trim().length > 0;
}

export function chavePendente(idLocal: string): string {
  return `captura7.rascunho.${idLocal}`;
}

export function gravarPendente(idLocal: string, campos: Campos): void {
  localStorage.setItem(chavePendente(idLocal), JSON.stringify(campos));
}

export function esquecerPendente(idLocal: string): void {
  localStorage.removeItem(chavePendente(idLocal));
}

export function limparPendenteSeIgual(idLocal: string, foto: string): void {
  if (localStorage.getItem(chavePendente(idLocal)) === foto) esquecerPendente(idLocal);
}

export function lerPendente(idLocal: string): Partial<Campos> {
  const bruto = localStorage.getItem(chavePendente(idLocal));
  if (!bruto) return {};
  try {
    const json: unknown = JSON.parse(bruto);
    if (!json || typeof json !== 'object') return {};
    const saida: Partial<Campos> = {};
    for (const chave of Object.keys(VAZIO) as (keyof Campos)[]) {
      const valor = (json as Record<string, unknown>)[chave];
      if (typeof valor === 'string') saida[chave] = valor;
    }
    return saida;
  } catch {
    return {};
  }
}

export function textoConsentimento(contato: ContatoLocal | null, statusServidor: string): string {
  const status =
    statusServidor ||
    (contato?.consentimento?.contatoComercial
      ? 'escolha neste aparelho, ainda sem confirmação do servidor'
      : 'pendente');
  if (status === 'concedido') {
    return 'Consentimento de contato comercial: concedido. Este lead pode entrar na exportação do administrador.';
  }
  if (status === 'revogado') {
    return 'Consentimento de contato comercial: revogado. Este lead fica fora da exportação.';
  }
  if (status === 'pendente') {
    return 'Consentimento de contato comercial: pendente. O lead pode ficar salvo assim. Ele fica fora da exportação até o titular autorizar.';
  }
  return `Consentimento de contato comercial: ${status}.`;
}

export function Campo({ rotulo, registro }: { rotulo: string; registro: UseFormRegisterReturn }) {
  const teclado = tecladoDe(rotulo);
  return (
    <label className="mt-3 flex flex-col gap-1 text-base">
      {rotulo}
      <input
        className="campo"
        type={teclado.type}
        inputMode={teclado.inputMode}
        autoComplete={teclado.autoComplete}
        {...registro}
        onChange={(evento) => {
          if (teclado.mascara) evento.target.value = teclado.mascara(evento.target.value);
          void registro.onChange(evento);
        }}
      />
    </label>
  );
}

function tecladoDe(rotulo: string): {
  type?: string;
  inputMode?: 'tel' | 'email' | 'numeric';
  autoComplete?: string;
  mascara?: (valor: string) => string;
} {
  if (rotulo === 'Telefone')
    return { inputMode: 'tel', autoComplete: 'tel', mascara: mascararTelefone };
  if (rotulo === 'E-mail') return { type: 'email', inputMode: 'email', autoComplete: 'email' };
  if (rotulo === 'CPF') return { inputMode: 'numeric', mascara: mascararCpf };
  if (rotulo === 'CNPJ') return { inputMode: 'numeric', mascara: mascararCnpj };
  if (rotulo === 'CEP') return { inputMode: 'numeric', mascara: mascararCep };
  return {};
}

function mascararCpf(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function mascararCnpj(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
}

function mascararCep(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 8);
  return d.replace(/(\d{5})(\d{1,3})/, '$1-$2');
}
