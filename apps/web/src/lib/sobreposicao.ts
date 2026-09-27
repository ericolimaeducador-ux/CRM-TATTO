import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface EstadoHistorico {
  sobreposicao?: string;
  [chave: string]: unknown;
}

function estadoAtual(): EstadoHistorico | null {
  const estado: unknown = window.history.state;
  return estado && typeof estado === 'object' ? (estado as EstadoHistorico) : null;
}

/**
 * Estado de um painel sobreposto (menu, gaveta) que fecha sozinho.
 *
 * Fecha quando a rota muda, ao apertar Escape e no botão Voltar do Android:
 * ao abrir, empilha uma entrada no histórico com a mesma URL; o Voltar
 * consome essa entrada e fecha o painel em vez de sair da página.
 * `substituir` indica que um link escolhido de dentro do painel deve trocar
 * essa entrada (navegar com replace), para o histórico não ficar com sobra.
 */
export function useSobreposicao() {
  const [aberto, setAberto] = useState(false);
  const marca = useRef<string | null>(null);
  const local = useLocation();

  const abrir = useCallback(() => {
    if (marca.current) return;
    const nova = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.history.pushState({ ...estadoAtual(), sobreposicao: nova }, '');
    marca.current = nova;
    setAberto(true);
  }, []);

  const fechar = useCallback(() => {
    const atual = marca.current;
    marca.current = null;
    setAberto(false);
    if (atual && estadoAtual()?.sobreposicao === atual) {
      window.history.back();
    }
  }, []);

  const alternar = useCallback(() => {
    if (marca.current) fechar();
    else abrir();
  }, [abrir, fechar]);

  useEffect(() => {
    // Rota nova: a entrada do painel já foi trocada ou ficou para trás.
    marca.current = null;
    setAberto(false);
  }, [local.key]);

  useEffect(() => {
    if (!aberto) return undefined;
    function aoVoltar() {
      if (marca.current && estadoAtual()?.sobreposicao !== marca.current) {
        marca.current = null;
        setAberto(false);
      }
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') fechar();
    }
    window.addEventListener('popstate', aoVoltar);
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('popstate', aoVoltar);
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto, fechar]);

  return { aberto, abrir, fechar, alternar, substituir: aberto };
}
