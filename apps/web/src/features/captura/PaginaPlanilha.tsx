import { useState } from 'react';
import { PainelPlanilha } from './PainelPlanilha';

export function PaginaPlanilha() {
  const [mensagem, setMensagem] = useState('');
  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-3xl font-semibold">Importar e exportar</h1>
      <p className="text-base">Planilha de leads do TattooArt.</p>
      <PainelPlanilha aoMensagem={setMensagem} />
      {mensagem ? (
        <p className="toast" role="status">
          {mensagem}
        </p>
      ) : null}
    </section>
  );
}
