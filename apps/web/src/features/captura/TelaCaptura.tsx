import { useNavigate } from 'react-router-dom';
import { criarIdLocal } from '@/lib/offline/fila';

export function TelaCaptura() {
  const navegar = useNavigate();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Tela Viva</h1>
      <p className="text-base">
        Uma nova conexão começa aqui. Capture um contato por QR ou digitação, mesmo sem internet.
      </p>
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
    </section>
  );
}
