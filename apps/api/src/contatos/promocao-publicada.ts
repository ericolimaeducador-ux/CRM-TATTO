export interface PromocaoCliente {
  contatoId: string;
  versao: number;
  autorId: string;
  em: string;
}

type Ouvinte = (evento: PromocaoCliente) => void | Promise<void>;

const ouvintes = new Set<Ouvinte>();

export function aoPromoverCliente(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function publicarPromocaoCliente(evento: PromocaoCliente): void {
  for (const ouvinte of ouvintes) {
    Promise.resolve()
      .then(() => ouvinte(evento))
      .catch((erro: unknown) => {
        const mensagem = erro instanceof Error ? erro.message : 'falha no ouvinte';
        console.error(JSON.stringify({ nivel: 'ERROR', evento: 'webhook_ouvinte', mensagem }));
      });
  }
}
