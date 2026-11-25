/**
 * Aviso interno de que um contato mudou (qualificação, edição da ficha, responsável).
 * O módulo de vendas escuta para manter a conta da carteira em dia (ADR-028).
 * Diferente da promoção a cliente, aqui o aviso é aguardado: quem qualifica e abre a
 * carteira logo em seguida já encontra a conta. Falha de um ouvinte nunca desfaz a
 * gravação do contato; só fica registrada no log.
 */
export interface ContatoAlterado {
  contatoId: string;
  autorId: string;
}

type Ouvinte = (evento: ContatoAlterado) => void | Promise<void>;

const ouvintes = new Set<Ouvinte>();

export function aoAlterarContato(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export async function publicarContatoAlterado(evento: ContatoAlterado): Promise<void> {
  for (const ouvinte of ouvintes) {
    try {
      await ouvinte(evento);
    } catch (erro: unknown) {
      const mensagem = erro instanceof Error ? erro.message : 'falha no ouvinte';
      console.error(
        JSON.stringify({ nivel: 'ERROR', evento: 'contato_alterado_ouvinte', mensagem }),
      );
    }
  }
}
