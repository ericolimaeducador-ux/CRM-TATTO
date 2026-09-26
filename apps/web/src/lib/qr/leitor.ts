interface CodigoDetectado {
  rawValue?: string;
}

interface DetectorDeCodigo {
  detect(fonte: HTMLVideoElement): Promise<CodigoDetectado[]>;
}

type ConstrutorDetector = new (opcoes: { formats: string[] }) => DetectorDeCodigo;

export function mensagemCamera(origem: { protocol: string; hostname: string }): string | null {
  const local = origem.hostname === 'localhost' || origem.hostname === '127.0.0.1';
  if (origem.protocol === 'https:' || local) return null;
  return 'A câmera só abre em HTTPS. Neste endereço sem TLS, digite o contato. Em localhost ela pode funcionar.';
}

export async function iniciarLeitura(
  video: HTMLVideoElement | null,
  aoLer: (texto: string) => void,
): Promise<() => void> {
  if (!video) return () => undefined;
  const Detector = (window as unknown as { BarcodeDetector?: ConstrutorDetector }).BarcodeDetector;
  if (Detector) return lerNativo(Detector, video, aoLer);
  const modulo = await import('@zxing/browser');
  const leitor = new modulo.BrowserMultiFormatReader();
  const controles = await leitor.decodeFromVideoDevice(undefined, video, (resultado) => {
    if (resultado) aoLer(resultado.getText());
  });
  return () => controles.stop();
}

async function lerNativo(
  Detector: ConstrutorDetector,
  video: HTMLVideoElement,
  aoLer: (texto: string) => void,
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
  });
  video.srcObject = stream;
  await video.play();
  const detector = new Detector({ formats: ['qr_code'] });
  let vivo = true;
  const quadro = async (): Promise<void> => {
    if (!vivo) return;
    try {
      const codigos = await detector.detect(video);
      const valor = codigos[0]?.rawValue;
      if (valor) {
        aoLer(valor);
        return;
      }
    } catch {
      // O quadro seguinte tenta de novo. A leitura não é descartada por um frame ruim.
    }
    if (vivo) requestAnimationFrame(() => void quadro());
  };
  void quadro();
  return () => {
    vivo = false;
    for (const trilha of stream.getTracks()) trilha.stop();
  };
}
