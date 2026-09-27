import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';

export interface DadosInscricao {
  segredo: string;
  otpauth: string;
}

/** Chave em blocos de 4 para ler e digitar sem errar: ABCD EFGH IJKL. */
export function agruparChave(segredo: string): string {
  return (segredo.replace(/\s+/g, '').match(/.{1,4}/g) ?? []).join(' ');
}

export async function copiarTexto(texto: string): Promise<boolean> {
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

/** Botão Copiar com fallback; mostra "Copiado" ou pede a cópia manual. */
export function BotaoCopiar({ texto, rotulo = 'Copiar' }: { texto: string; rotulo?: string }) {
  const [estado, setEstado] = useState<'' | 'ok' | 'falhou'>('');
  useEffect(() => setEstado(''), [texto]);
  return (
    <>
      <button
        type="button"
        className="btn-secundario"
        onClick={() => void copiarTexto(texto).then((ok) => setEstado(ok ? 'ok' : 'falhou'))}
      >
        {estado === 'ok' ? 'Copiado' : rotulo}
      </button>
      {estado === 'falhou' ? (
        <p className="text-sm" role="status">
          Não consegui copiar. Selecione o texto e copie à mão.
        </p>
      ) : null}
    </>
  );
}

/**
 * Passos para cadastrar a conta no autenticador: link otpauth, QR gerado no
 * aparelho, chave em blocos de 4 com Copiar e instruções do Google Authenticator.
 */
export function ConfiguracaoTotp({
  dados,
  titulo,
  paraOutraPessoa = false,
  children,
}: {
  dados: DadosInscricao;
  titulo: string;
  paraOutraPessoa?: boolean;
  children?: ReactNode;
}) {
  const [qr, setQr] = useState('');
  const bloco = useRef<HTMLElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    let vivo = true;
    setQr('');
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

  return (
    <section ref={bloco} className="inscricao-totp" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="text-xl font-semibold">
        {titulo}
      </h2>

      <div className="passo-totp">
        <p className="passo-rotulo">
          {paraOutraPessoa ? 'No celular da pessoa' : '1. Neste celular'}
        </p>
        {dados.otpauth ? (
          <a className="btn" href={dados.otpauth}>
            Abrir no Google Authenticator
          </a>
        ) : null}
        <p className="text-sm">O autenticador abre com a conta TattooArt pronta para salvar.</p>
      </div>

      {qr ? (
        <div className="passo-totp">
          <p className="passo-rotulo">
            {paraOutraPessoa ? 'Ou mostre este QR code' : 'Abriu esta tela no computador?'}
          </p>
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
        <BotaoCopiar texto={dados.segredo} />
        <ol className="lista-passos text-sm">
          <li>Abra o Google Authenticator e toque em +.</li>
          <li>Toque em Inserir chave de configuração.</li>
          <li>Em Nome da conta, escreva TattooArt.</li>
          <li>Em Sua chave, cole ou digite a chave acima (os espaços não importam).</li>
          <li>Em Tipo de chave, escolha Baseado em tempo e toque em Adicionar.</li>
        </ol>
      </div>
      {children}
    </section>
  );
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
  const [codigo, setCodigo] = useState(codigoInicial);
  return (
    <ConfiguracaoTotp dados={dados} titulo="Cadastre o TattooArt no seu autenticador">
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
    </ConfiguracaoTotp>
  );
}
