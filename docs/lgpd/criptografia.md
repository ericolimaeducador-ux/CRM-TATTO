# Criptografia de CPF e CNPJ

ADR-004, confirmado no F0-03.

- `pf.cpfCifrado` e `pj.cnpjCifrado` usam AES-256-GCM. A chave vem de `CIFRA_CHAVE_BASE64` (32 bytes). Ela não entra no repositório.
- `pf.cpfHash` e `pj.cnpjHash` usam HMAC-SHA256 com `CIFRA_PEPPER`. O índice único parcial aponta para o hash, nunca para o valor puro nem para a cifra.
- A lista mostra `cpfMascarado` / `cnpjMascarado`.
- Busca por documento é exata, pelo hash. Não há busca parcial.
- O schema não tem campo de CPF ou CNPJ em texto puro. O valor entra por `$locals` no servidor e sai da memória do documento antes do `save`.
