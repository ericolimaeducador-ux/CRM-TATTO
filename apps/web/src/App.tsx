import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { BarraSincronizacao } from './features/captura/BarraSincronizacao';
import { FormularioCaptura } from './features/captura/FormularioCaptura';
import { ListaContatos } from './features/captura/ListaContatos';
import { MeuQr } from './features/captura/MeuQr';
import { PaginaDuplicatas } from './features/captura/PaginaDuplicatas';
import { PaginaFila } from './features/captura/PaginaFila';
import { PaginaMerge } from './features/captura/PaginaMerge';
import { PaginaPromover } from './features/captura/PaginaPromover';
import { PaginaQr } from './features/captura/PaginaQr';
import { TelaCaptura } from './features/captura/TelaCaptura';
import { iniciarFila } from './lib/offline/fila';

export function App() {
  useEffect(() => {
    iniciarFila();
  }, []);
  return (
    <BrowserRouter>
      <main className="mx-auto min-h-screen w-full max-w-xl p-4">
        <BarraSincronizacao />
        <Routes>
          <Route path="/" element={<TelaCaptura />} />
          <Route path="/capturar" element={<TelaCaptura />} />
          <Route path="/capturar/qr" element={<PaginaQr />} />
          <Route path="/contatos" element={<ListaContatos />} />
          <Route path="/contatos/:idLocal" element={<FormularioCaptura />} />
          <Route path="/fila" element={<PaginaFila />} />
          <Route path="/duplicatas" element={<PaginaDuplicatas />} />
          <Route path="/merge/:a/:b" element={<PaginaMerge />} />
          <Route path="/promover/:id" element={<PaginaPromover />} />
          <Route path="/meu-qr" element={<MeuQr />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
