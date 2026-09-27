import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { criarIdLocal } from '@/lib/offline/fila';
import { PainelResumo } from './PainelResumo';

export function TelaCaptura() {
  const navegar = useNavigate();
  return (
    <section className="flex flex-col gap-6">
      <h1 className="sr-only">TattooArt</h1>
      <p className="text-lg">O nome já grava o lead.</p>
      <button
        type="button"
        className="btn btn-grande"
        onClick={() => navegar(`/contatos/${criarIdLocal()}`)}
      >
        <Plus aria-hidden="true" />
        Novo cadastro
      </button>
      <PainelResumo />
      <div className="grid gap-3 sm:grid-cols-3">
        <button type="button" className="btn" onClick={() => navegar('/capturar/qr')}>
          Ler QR
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => navegar(`/contatos/${criarIdLocal()}`)}
        >
          Digitar
        </button>
        <button type="button" className="btn-secundario" onClick={() => navegar('/meu-qr')}>
          Meu QR
        </button>
      </div>
    </section>
  );
}
