import { useEffect, useRef, useState } from 'react';
import { iniciarLeitura, mensagemCamera } from '@/lib/qr/leitor';
import { parsearQr, type LeituraQr } from '@/lib/qr/parsear';

interface Propriedades {
  onLido: (leitura: LeituraQr) => void;
  onDigitar: () => void;
}

export function LeitorQr({ onLido, onDigitar }: Propriedades) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const explicacao = mensagemCamera(window.location);
    if (explicacao) {
      setAviso(explicacao);
      return;
    }
    let cancelado = false;
    let parar = () => undefined as void;
    void iniciarLeitura(videoRef.current, (texto) => {
      if (cancelado) return;
      cancelado = true;
      parar();
      onLido(parsearQr(texto));
    })
      .then((fn) => {
        parar = fn;
        if (cancelado) parar();
      })
      .catch(() => {
        if (!cancelado) setAviso('A câmera não abriu. Digite o contato nesta mesma tela.');
      });
    return () => {
      cancelado = true;
      parar();
    };
  }, [onLido]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Ler QR</h1>
      <video ref={videoRef} className="w-full rounded-lg bg-stone-900" muted playsInline />
      {aviso ? <p className="text-base text-amber-900">{aviso}</p> : null}
      <button type="button" className="btn" onClick={onDigitar}>
        Digitar em vez disso
      </button>
    </section>
  );
}
