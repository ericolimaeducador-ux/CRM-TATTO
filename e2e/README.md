# Testes de navegação

A suíte Playwright verifica captura em rede/offline, persistência ao fechar a aba, fila presa, promoção, fusão, consentimento e os fluxos comerciais do Tela Viva quando presentes.

Os testes usam MongoDB temporário e API própria; não apontam para a base real. A API de teste liga `CAPTURA7_HEADERS_TESTE=1`, e o build web de teste liga `VITE_CAPTURA7_HEADERS_TESTE=1`. Esses builds não devem ser publicados como produção.

Os testes devem rodar contra o build web, pois a verificação offline depende do service worker. A instalação do navegador é feita com `corepack pnpm exec playwright install chromium`.

O comando e os resultados efetivamente executados neste ciclo ficam em [PROGRESS_FASE_TELA_VIVA.md](../PROGRESS_FASE_TELA_VIVA.md).
