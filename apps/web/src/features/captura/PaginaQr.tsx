import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { criarIdLocal, garantirContato, salvarCampo } from '@/lib/offline/fila';
import type { LeituraQr } from '@/lib/qr/parsear';
import { LeitorQr } from './LeitorQr';

export function PaginaQr() {
  const navegar = useNavigate();
  const aoLer = useCallback(
    async (leitura: LeituraQr) => {
      const idLocal = criarIdLocal();
      await garantirContato(idLocal, 'qr_lido', leitura.payloadBruto);
      const pares: [string, string | undefined][] = [
        ['nome', leitura.nome],
        ['telefone', leitura.telefone],
        ['email', leitura.email],
        ['observacoes', leitura.observacoes],
      ];
      for (const [campo, valor] of pares) {
        if (valor) await salvarCampo(idLocal, campo, valor);
      }
      navegar(`/contatos/${idLocal}`, { state: { naoReconhecido: !leitura.reconhecido } });
    },
    [navegar],
  );
  const digitar = useCallback(() => {
    navegar(`/contatos/${criarIdLocal()}`);
  }, [navegar]);

  return <LeitorQr onLido={(leitura) => void aoLer(leitura)} onDigitar={digitar} />;
}
