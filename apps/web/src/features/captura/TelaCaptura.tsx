import { Link, useNavigate } from 'react-router-dom';
import { criarIdLocal } from '@/lib/offline/fila';

export function TelaCaptura() {
  const navegar = useNavigate();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">captura7</h1>
      <p className="text-base">Três caminhos. O nome já grava o lead.</p>
      <button
        type="button"
        className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white"
        onClick={() => navegar('/capturar/qr')}
      >
        Ler QR
      </button>
      <button
        type="button"
        className="min-h-12 rounded-lg bg-stone-900 px-4 text-base text-white"
        onClick={() => navegar(`/contatos/${criarIdLocal()}`)}
      >
        Digitar
      </button>
      <button
        type="button"
        className="min-h-12 rounded-lg border border-stone-900 px-4 text-base"
        onClick={() => navegar('/meu-qr')}
      >
        Meu QR
      </button>
      <Link className="inline-flex min-h-12 items-center text-base underline" to="/contatos">
        Contatos deste aparelho
      </Link>
      <Link className="inline-flex min-h-12 items-center text-base underline" to="/fila">
        Fila
      </Link>
      <Link className="inline-flex min-h-12 items-center text-base underline" to="/duplicatas">
        Duplicatas
      </Link>
    </section>
  );
}
