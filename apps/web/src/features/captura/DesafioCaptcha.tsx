import { useEffect } from 'react';

export function DesafioCaptcha({
  provedor,
  sitekey,
  pergunta,
  valor,
  aoMudar,
}: {
  provedor: string;
  sitekey: string;
  pergunta: string;
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  useEffect(() => {
    if ((provedor !== 'hcaptcha' && provedor !== 'turnstile') || !sitekey) return;
    const src =
      provedor === 'hcaptcha'
        ? 'https://js.hcaptcha.com/1/api.js'
        : 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [provedor, sitekey]);

  useEffect(() => {
    if ((provedor !== 'hcaptcha' && provedor !== 'turnstile') || !sitekey) return;
    const id = window.setInterval(() => {
      const token = tokenDoWidget('');
      if (token && token !== valor) aoMudar(token);
    }, 400);
    return () => window.clearInterval(id);
  }, [provedor, sitekey, valor, aoMudar]);

  if (provedor === 'local' || !provedor) {
    if (!pergunta) return null;
    return (
      <label className="flex flex-col gap-1 text-base">
        Resposta do desafio
        <span data-testid="pergunta-captcha">{pergunta}</span>
        <input
          className="min-h-12 rounded border border-stone-300 px-3"
          value={valor}
          onChange={(evento) => aoMudar(evento.target.value)}
        />
      </label>
    );
  }

  if (!sitekey) {
    return (
      <p className="text-base">
        O captcha deste site ainda não foi configurado pelo controlador. O cadastro não conclui até
        isso.
      </p>
    );
  }

  return (
    <div
      className={provedor === 'hcaptcha' ? 'h-captcha' : 'cf-turnstile'}
      data-sitekey={sitekey}
      data-testid="widget-captcha"
    />
  );
}

export function tokenDoWidget(manual: string): string {
  if (manual.trim()) return manual.trim();
  const campo = document.querySelector<HTMLTextAreaElement>(
    '[name="h-captcha-response"], [name="cf-turnstile-response"]',
  );
  return campo?.value ?? '';
}
