import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import './navegacao.css';
import './listas.css';
import './desktop.css';

const raiz = document.getElementById('root');
if (!raiz) {
  throw new Error('Elemento #root ausente.');
}

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
