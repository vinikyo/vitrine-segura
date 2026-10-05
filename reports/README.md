# Testes do servidor Vitrine

Execução em 05/10/2026. Baseline GitHub: `5e80a14406739b390648862c3b2224fd9eafd48c`.

Resultado: **69 testes executados, 64 aprovados e 5 reprovados**. São 20 unitários, 13 funcionais, 18 de segurança funcional e 18 de segurança/erro. O processo de testes retorna exit code 1 enquanto os cinco critérios adicionais de endurecimento não forem atendidos. Não ignore esse exit code nem substitua os resultados por sucesso.

## Reproduzir

Com Node 24 (ou versão que disponibilize `node:sqlite`) e dependências instaladas:

```sh
npm test
npm run test:unit
npm run test:functional
npm run test:security
```

`tests/server.test.cjs` usa `node:test` e `node:assert/strict`. `tests/harness.cjs` transpila os arquivos reais em memória, injeta autenticação e ambiente de teste e usa SQLite isolado. As funções privadas são expostas somente pelo módulo de teste em memória; o código de produção permanece inalterado. Cada caso parte de um banco novo. Nenhum teste grava na loja publicada.

O arquivo `reports/server-tests.json` é sobrescrito a cada execução. Use `TEST_REPORT_PATH` para conservar execuções distintas. Comandos filtrados contêm somente os casos executados, não o relatório completo. A chave fixa presente no harness é exclusivamente de teste, não a chave de produção.

## Casos reprovados e ações

| Caso | Observado | Critério adicional proposto | Ação |
| --- | --- | --- | --- |
| E14 | `application/jsonp` aceito, HTTP 200 | Rejeitar com 415 | Comparar o tipo de mídia completo antes dos parâmetros. |
| E15 | Corpo Unicode acima de 10000 bytes chega ao processamento, HTTP 400 | Limite por bytes, HTTP 413 | Aplicar limite em bytes e proteção antes de buffering. Hoje o limite usa caracteres, conforme a implementação. |
| E16 | Falha interna de banco retorna HTTP 400 | Usar 500/503 | Distinguir erro operacional de validação, preservando mensagens genéricas. |
| E17 | Mesmo nonce com quantidade diferente retorna HTTP 200 sem novo pedido | Conflito HTTP 409 | Persistir fingerprint do carrinho e comparar na repetição. Não houve duplicação nem baixa extra. |
| E18 | Chave ausente retorna HTTP 400, sem gravar perfil | Usar 500/503 | Falhar de modo fechado com status operacional correto. Compartilha causa de classificação com E16. |

As últimas cinco expectativas são regras adicionais de endurecimento, não requisitos originalmente documentados. São cinco cenários reprovados, não cinco explorações demonstradas. Nenhuma correção de produção foi incluída neste commit.

## Processo e limites

TypeScript e build de produção passaram. Um GET anônimo, somente leitura, no endpoint publicado retornou 401 do gateway. Isso demonstra negação de acesso anônimo, não testa o login completo ou a sessão de usuário.

Não foram executados browser E2E, scanners DAST, pentest externo, carga, auditoria de dependências, autenticação externa, cookies do gateway, backup/restauração ou testes multi-isolate no D1 hospedado. O teste S18 simula esgotamento de estoque entre consulta e batch no adapter SQLite e verifica rollback; não é um teste de carga concorrente em Cloudflare.

Não há percentual de cobertura instrumentado. O teste S14 avalia transporte de payload XSS em JSON; não comprova ausência de XSS no navegador. CPF é validado por formato para aceitar dados fictícios. Pagamento e transporte reais não fazem parte do sistema demonstrativo.

Pessoas: Codex executou automação e produziu as evidências. Vinícius Francisco Garcia Sobral é o responsável pelo projeto e pela homologação ainda pendente. Revisor independente de segurança e responsável operacional ainda precisam ser designados. Não foi simulada participação de pessoas.

Referências: [OWASP Authorization Testing Automation](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Testing_Automation_Cheat_Sheet.html), [Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html), [Error Handling](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html).
