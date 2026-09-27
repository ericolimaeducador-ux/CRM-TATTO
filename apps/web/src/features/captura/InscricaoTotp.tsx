import { Fragment, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export interface DadosInscricao {
  segredo: string;
  otpauth: string;
}

/** Chave em blocos de 4 para ler e digitar sem errar: ABCD EFGH IJKL. */
export function agruparChave(segredo: string): string {
  return (segredo.replace(/\s+/g, '').match(/.{1,4}/g) ?? []).join(' ');
}

async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Sem permissão para a área de transferência: tenta o caminho antigo.
  }
  try {
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.setAttribute('readonly', '');
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    document.body.appendChild(campo);
    campo.select();
    const copiou = document.execCommand?.('copy') ?? false;
    document.body.removeChild(campo);
    return copiou;
  } catch {
    return false;
  }
}

export function InscricaoTotp({
  dados,
  codigoInicial,
  aoAtivar,
}: {
  dados: DadosInscricao;
  codigoInicial: string;
  aoAtivar: (codigo: string) => void;
}) {
  const [qr, setQr] = useState('');
  const [codigo, setCodigo] = useState(codigoInicial);
  const [copia, setCopia] = useState<'' | 'ok' | 'falhou'>('');
  const bloco = useRef<HTMLElement>(null);

  useEffect(() => {
    let vivo = true;
    setQr('');
    setCopia('');
    if (dados.otpauth) {
      QRCode.toString(dados.otpauth, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
        .then((svg) => {
          if (vivo) setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        })
        .catch(() => undefined);
    }
    bloco.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    return () => {
      vivo = false;
    };
  }, [dados.otpauth, dados.segredo]);

  async function copiar() {
    setCopia((await copiarTexto(dados.segredo)) ? 'ok' : 'falhou');
  }

  return (
    <section ref={bloco} className="inscricao-totp" aria-labelledby="titulo-inscricao-totp">
      <h2 id="titulo-inscricao-totp" className="text-xl font-semibold">
        Cadastre o TattooArt no seu autenticador
      </h2>

      <div className="passo-totp">
        <p className="passo-rotulo">1. Neste celular</p>
        {dados.otpauth ? (
          <a className="btn" href={dados.otpauth}>
            Abrir no Google Authenticator
          </a>
        ) : null}
        <p className="text-sm">O autenticador abre com a conta TattooArt pronta para salvar.</p>
      </div>

      {qr ? (
        <div className="passo-totp">
          <p className="passo-rotulo">Abriu esta tela no computador?</p>
          <p className="text-sm">
            No Google Authenticator do celular, toque em + e em Ler QR code.
          </p>
          <img
            className="qr-totp"
            src={qr}
            width={200}
            height={200}
            alt="QR code para cadastrar o TattooArt no autenticador"
          />
        </div>
      ) : null}

      <div className="passo-totp">
        <p className="passo-rotulo">Ou digite a chave de configuração</p>
        <p className="chave-totp" data-testid="segredo-totp">
          {agruparChave(dados.segredo)
            .split(' ')
            .map((bloco, indice) => (
              <Fragment key={indice}>
                {indice > 0 ? ' ' : null}
                <span>{bloco}</span>
              </Fragment>
            ))}
        </p>
        <button type="button" className="btn-secundario" onClick={() => void copiar()}>
          {copia === 'ok' ? 'Chave copiada' : 'Copiar'}
        </button>
        {copia === 'falhou' ? (
          <p className="text-sm" role="status">
            Não consegui copiar. Selecione a chave e copie à mão.
          </p>
        ) : null}
        <ol className="lista-passos text-sm">
          <li>Abra o Google Authenticator e toque em +.</li>
          <li>Toque em Inserir chave de configuração.</li>
          <li>Em Nome da conta, escreva TattooArt.</li>
          <li>Em Sua chave, cole ou digite a chave acima (os espaços não importam).</li>
          <li>Em Tipo de chave, escolha Baseado em tempo e toque em Adicionar.</li>
        </ol>
      </div>

      <div className="passo-totp">
        <p className="passo-rotulo">2. Confirme o código</p>
        <label className="flex flex-col gap-1 text-base">
          Código de 6 dígitos do autenticador
          <input
            className="campo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(evento) => setCodigo(evento.target.value.replace(/\D/g, ''))}
          />
        </label>
        <button type="button" className="btn" onClick={() => aoAtivar(codigo)}>
          Ativar autenticador
        </button>
        <p className="text-sm">
          Tocar em Inscrever autenticador de novo gera outra chave, e só a última vale. Se isso
          acontecer, apague a conta antiga do autenticador e cadastre a nova.
        </p>
      </div>
    </section>
  );
}
