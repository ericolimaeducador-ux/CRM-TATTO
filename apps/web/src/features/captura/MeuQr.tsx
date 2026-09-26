import { Link } from 'react-router-dom';

export function MeuQr() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Meu QR</h1>
      <p className="text-base">
        O QR próprio e o autocadastro esperam o texto do termo de consentimento. Esse texto não é
        redigido aqui.
      </p>
      <Link className="inline-flex min-h-12 items-center text-base underline" to="/capturar">
        Voltar para capturar
      </Link>
    </section>
  );
}
