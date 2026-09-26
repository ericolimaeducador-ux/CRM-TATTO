import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { guardarConsentimento, lerUm } from '@/lib/offline/fila';
import type { ContatoLocal } from '@/lib/offline/tipos';
import { TelaTermo } from './TelaTermo';

export function PaginaConsentimento() {
  const { idLocal = '' } = useParams();
  const [contato, setContato] = useState<ContatoLocal | null>(null);
  useEffect(() => {
    void lerUm(idLocal).then((atual) => setContato(atual ?? null));
  }, [idLocal]);
  return (
    <TelaTermo
      modo="vendedor"
      idServidor={contato?.idServidor}
      aoGuardarLocal={(emDispositivo, envioErp) =>
        guardarConsentimento(idLocal, emDispositivo, envioErp)
      }
    />
  );
}
