import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AvisoServidor } from '../captura/AvisoServidor';
import { BarraSincronizacao } from '../captura/BarraSincronizacao';
import { Menu } from '../captura/Menu';
import { Marca } from './Marca';

export function Casca({ children }: { children: ReactNode }) {
  const local = useLocation();
  const publico = local.pathname.startsWith('/p/');
  if (publico) {
    return (
      <div className="min-h-screen">
        <header className="mx-auto w-full max-w-xl px-4 pt-6">
          <Marca />
        </header>
        <main className="mx-auto w-full max-w-xl p-4">{children}</main>
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <Menu />
      <main className="conteudo">
        <div className="mb-4 lg:hidden">
          <Marca />
        </div>
        <AvisoServidor />
        <BarraSincronizacao />
        {children}
      </main>
    </div>
  );
}
