import { useEffect, useState } from 'react';
import { observarAcordar } from '@/lib/acordar';

export function AvisoServidor() {
  const [texto, setTexto] = useState('');

  useEffect(() => observarAcordar(setTexto), []);

  if (!texto) return null;
  return (
    <p role="status" className="mb-3 text-base">
      {texto} O que já está neste aparelho continua disponível.
    </p>
  );
}
