import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DetalheConta } from './features/comercial/DetalheConta';
import { Layout } from './features/comercial/Layout';
import { PainelComercial } from './features/comercial/PainelComercial';
import { PaginaRegistros } from './features/comercial/PaginaRegistros';
import { PaginaPrecosCliente } from './features/comercial/PaginaPrecosCliente';
import { PaginaTreinamentos } from './features/comercial/PaginaTreinamentos';
import { DetalheTreinamento } from './features/comercial/DetalheTreinamento';
import { InscricaoTreinamento } from './features/comercial/InscricaoTreinamento';
import { PaginaRelatorios } from './features/comercial/PaginaRelatorios';
import { PaginaCampanhas } from './features/comercial/PaginaCampanhas';

import { PaginaBusca } from './features/captura/PaginaBusca';
import { PaginaLead } from './features/captura/PaginaLead';
import { PaginaUsuarios } from './features/captura/PaginaUsuarios';
import { FormularioCaptura } from './features/captura/FormularioCaptura';
import { ListaContatos } from './features/captura/ListaContatos';
import { MeuQr } from './features/captura/MeuQr';
import { PaginaAutocadastro } from './features/captura/PaginaAutocadastro';
import { PaginaTermoCompleto } from './features/captura/PaginaTermoCompleto';
import { PaginaEntrar } from './features/captura/PaginaEntrar';
import { PaginaMinhaConta } from './features/captura/PaginaMinhaConta';
import { PaginaConsentimento } from './features/captura/PaginaConsentimento';
import { PaginaDuplicatas } from './features/captura/PaginaDuplicatas';
import { PaginaFila } from './features/captura/PaginaFila';
import { PaginaMerge } from './features/captura/PaginaMerge';
import { PaginaPromover } from './features/captura/PaginaPromover';
import { PaginaQr } from './features/captura/PaginaQr';
import { TelaCaptura } from './features/captura/TelaCaptura';
import { PaginaCadastros } from './features/captura/PaginaCadastros';
import { PaginaPlanilha } from './features/captura/PaginaPlanilha';
import { iniciarFila } from './lib/offline/fila';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

export function App() {
  useEffect(() => {
    iniciarFila();
  }, []);
  return (
    <BrowserRouter basename={basename}>
      <Layout>
        <Routes>
          <Route path="/" element={<PainelComercial />} />
          <Route path="/carteira/:id" element={<DetalheConta />} />
          <Route path="/carteira" element={<PaginaRegistros key="contas" secao="contas" />} />
          <Route path="/agenda" element={<PaginaRegistros key="atividades" secao="atividades" />} />
          <Route
            path="/oportunidades"
            element={<PaginaRegistros key="oportunidades" secao="oportunidades" />}
          />
          <Route path="/produtos" element={<PaginaRegistros key="produtos" secao="produtos" />} />
          <Route path="/precos" element={<PaginaPrecosCliente />} />
          <Route path="/treinamentos" element={<PaginaTreinamentos />} />
          <Route path="/relatorios" element={<PaginaRelatorios />} />
          <Route path="/campanhas" element={<PaginaCampanhas />} />
          <Route path="/campanhas/:id" element={<PaginaCampanhas />} />
          <Route path="/treinamentos/:id" element={<DetalheTreinamento />} />
          <Route path="/inscricao-treinamento/:token" element={<InscricaoTreinamento />} />
          <Route
            path="/propostas"
            element={<PaginaRegistros key="propostas" secao="propostas" />}
          />
          <Route path="/entrar" element={<PaginaEntrar />} />
          <Route path="/minha-conta" element={<PaginaMinhaConta />} />
          <Route path="/capturar" element={<TelaCaptura />} />
          <Route path="/capturar/qr" element={<PaginaQr />} />
          <Route path="/cadastros" element={<PaginaCadastros />} />
          <Route path="/planilha" element={<PaginaPlanilha />} />
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
          <Route path="/termo" element={<PaginaTermoCompleto />} />
          <Route path="/contatos/:idLocal/termo" element={<PaginaConsentimento />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
