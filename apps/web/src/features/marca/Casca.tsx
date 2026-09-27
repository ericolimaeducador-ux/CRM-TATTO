import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AvisoServidor } from '../captura/AvisoServidor';
import { BarraSincronizacao } from '../captura/BarraSincronizacao';
import { Menu } from '../captura/Menu';
import { TelaNovaSenha } from '../captura/TelaNovaSenha';
import { trocaSenhaLocal } from '@/lib/offline/sessao';
import { Marca } from './Marca';

export function Casca({ children }: { children: ReactNode }) {
  const local = useLocation();
  const [, atualizar] = useState(0);
  if (!local.pathname.startsWith('/p/') && trocaSenhaLocal()) {
    return <TelaNovaSenha aoConcluir={() => atualizar((valor) => valor + 1)} />;
  }
  if (local.pathname.startsWith('/p/')) {
    return (
      <div className="min-h-screen">
        <header className="mx-auto w-full max-w-xl px-4 pt-8">
          <Marca />
        </header>
        <main className="mx-auto w-full max-w-xl p-4">{children}</main>
      </div>
    );
  }
  if (local.pathname === '/entrar') {
    return (
      <div className="min-h-screen">
        <AvisoServidor />
        {children}
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <Menu />
      <main className="conteudo">
        <div className="mb-6 lg:hidden">
          <Marca />
        </div>
        <AvisoServidor />
        <BarraSincronizacao />
        {children}
      </main>
    </div>
  );
}
