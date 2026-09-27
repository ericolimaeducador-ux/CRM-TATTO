import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { BarraSincronizacao } from './features/captura/BarraSincronizacao';
import { Menu } from './features/captura/Menu';
import { PaginaBusca } from './features/captura/PaginaBusca';
import { PaginaLead } from './features/captura/PaginaLead';
import { PaginaUsuarios } from './features/captura/PaginaUsuarios';
import { FormularioCaptura } from './features/captura/FormularioCaptura';
import { ListaContatos } from './features/captura/ListaContatos';
import { MeuQr } from './features/captura/MeuQr';
import { PaginaAutocadastro } from './features/captura/PaginaAutocadastro';
import { PaginaEntrar } from './features/captura/PaginaEntrar';
import { PaginaConsentimento } from './features/captura/PaginaConsentimento';
import { PaginaDuplicatas } from './features/captura/PaginaDuplicatas';
import { PaginaFila } from './features/captura/PaginaFila';
import { PaginaMerge } from './features/captura/PaginaMerge';
import { PaginaPromover } from './features/captura/PaginaPromover';
import { PaginaQr } from './features/captura/PaginaQr';
import { TelaCaptura } from './features/captura/TelaCaptura';
import { AvisoServidor } from './features/captura/AvisoServidor';
import { basenameDe } from './lib/base-publica';
import { iniciarFila } from './lib/offline/fila';

export function App() {
  useEffect(() => {
    iniciarFila();
  }, []);
  return (
    <BrowserRouter basename={basenameDe()}>
      <main className="mx-auto min-h-screen w-full max-w-xl p-4">
        <AvisoServidor />
        <BarraSincronizacao />
        <Menu />
        <Routes>
          <Route path="/" element={<TelaCaptura />} />
          <Route path="/entrar" element={<PaginaEntrar />} />
          <Route path="/capturar" element={<TelaCaptura />} />
          <Route path="/capturar/qr" element={<PaginaQr />} />
          <Route path="/contatos" element={<ListaContatos />} />
          <Route path="/contatos/:idLocal" element={<FormularioCaptura />} />
          <Route path="/fila" element={<PaginaFila />} />
          <Route path="/duplicatas" element={<PaginaDuplicatas />} />
          <Route path="/busca" element={<PaginaBusca />} />
          <Route path="/lead/:id" element={<PaginaLead />} />
          <Route path="/usuarios" element={<PaginaUsuarios />} />
          <Route path="/merge/:a/:b" element={<PaginaMerge />} />
          <Route path="/promover/:id" element={<PaginaPromover />} />
          <Route path="/meu-qr" element={<MeuQr />} />
          <Route path="/p/:token" element={<PaginaAutocadastro />} />
          <Route path="/contatos/:idLocal/termo" element={<PaginaConsentimento />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
