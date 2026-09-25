import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { FormularioCaptura } from './features/captura/FormularioCaptura';
import { MeuQr } from './features/captura/MeuQr';
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
        <Routes>
          <Route path="/" element={<TelaCaptura />} />
          <Route path="/capturar" element={<TelaCaptura />} />
          <Route path="/capturar/qr" element={<PaginaQr />} />
          <Route path="/contatos/:idLocal" element={<FormularioCaptura />} />
          <Route path="/meu-qr" element={<MeuQr />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
