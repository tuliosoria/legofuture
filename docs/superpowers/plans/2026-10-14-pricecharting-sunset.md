# BricksFuture — PriceCharting Sunset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Um escritor por repo; execução ainda não autorizada.

**Goal:** Operar sem chamadas PC/SportsCardsPro e sem transformar anúncios em valuation.

**Architecture:** Contrato de observações separa identidade, tipo, proveniência e validade. Transporte resiliente e política de publicação independentes dos modelos por produto.

**Tech Stack:** TypeScript, Next.js, Vitest; scripts Node existentes.

**Spec:** [ADR aprovada quanto ao comportamento](../../architecture/2026-10-14-pricecharting-sunset.md). Parâmetros operacionais propostos devem ser revisados antes da execução.

## Global Constraints

- Data-alvo 22/10/2026; horário desconhecido; preparação proposta 20/10/2026 00:00 UTC.
- 10 s por requisição; anúncio elegível por até 24 h, sujeito aos termos do fornecedor.
- Uma renovação após 401; 403 terminal; 429 com cooldown. Nenhum retry sem limite.
- Sem deleção, segredos, produção ou importação; push/deploy precisam de autorização própria.
- IDs, licença e condição exatos; asking/reference jamais sold ou âncora de forecast.

## Review Focus

- Cache sem observedAt: inelegível, sem rejuvenescimento (Task 1).
- Refresh concorrente e 429: uma requisição/cooldown por app (Task 2).
- Variante/condição/moeda errada: rejeitar, sem média entre tipos (Task 3).
- Build sem provedores: catálogo funciona sem forecasts inválidos (Task 3).
- Rollback após expiração: não reativar PC nem vendas falsas (Task 4).

### Task 1: Contrato, inventário e política

**Files:** Create `src/lib/domain/price-observation.ts`, `src/lib/domain/__tests__/price-observation.test.ts`, `docs/architecture/provider-artifact-manifest.md`.

**Interfaces:** Produces `PriceObservation`, `ProviderResult`, `evaluateObservation(observation: PriceObservation, policy: ObservationPolicy, now: Date): ProviderResult`, `isForecastAnchor(result: ProviderResult): boolean`; `ObservationPolicy` contém maxAgeMs, expectedProductId, expectedCurrency, expectedCondition e publicationAllowed.

- [ ] Escrever teste: asking válido é available mas isForecastAnchor=false; sold exato/publicável e amostra positiva pode ser true; NaN, preço <=0, data futura, ausência de observedAt e licença desconhecida são unavailable; idade >24 h é stale; fetchedAt novo não altera isso.
- [ ] Executar `npx vitest run src/lib/domain/__tests__/price-observation.test.ts`; confirmar falha pelo contrato ausente.
- [ ] Implementar contrato da ADR e manifesto por caminho/fonte/licença, sem ler dados pessoais ou apagar artefatos.
- [ ] Reexecutar teste e confirmar PASS; revisar diff e fazer commit só dos três arquivos.

### Task 2: Transporte eBay e consumo de quota

**Files:** Modify `src/lib/api/ebay/browse.ts`, `src/lib/api/ebay/token.ts`; Create `src/lib/api/ebay/__tests__/sunset-resilience.test.ts` e `src/lib/api/ebay/request-policy.ts`.

**Interfaces:** Consumes ProviderResult; produces `requestEbay(url: string, options: RequestOptions): Promise<Response>` com `RequestOptions = { fetchImpl: typeof fetch; now: () => number; signal?: AbortSignal; appBudgetKey: string; dailyLimit: number; maxPages: number }`, deadline, dedupe e cooldown. `dailyLimit` exige valor positivo comprovado; configuração ausente mantém provider indisponível. O transporte recebe autorização internamente do módulo de token e nunca a registra. Token não aparece no erro público. Política de quota recebe limite comprovado em configuração, sem default fictício.

- [ ] Escrever mocks: AbortSignal aborta em 10 s; 401→token novo→200 usa uma renovação; 401 persistente/403 para; 429 impede segundo consumidor durante Retry-After; rede quebrada difere de lista vazia; nenhuma credencial não chama fetch; máximo de páginas limita chamadas.
- [ ] Rodar `npx vitest run src/lib/api/ebay/__tests__/sunset-resilience.test.ts` e confirmar RED.
- [ ] Implementar requestEbay e adaptar Browse/token sem URLs autenticadas nos logs.
- [ ] Confirmar GREEN, revisar concorrência e fazer commit de caminhos explícitos.

### Task 3: Adaptar BricksFuture e apresentação honesta

**Files:** Modify `src/lib/domain/lego-forecast.ts`, `scripts/sync-ebay-sold-listings.mjs`, `scripts/sync-ebay-comps.mjs`, `scripts/sync-all.sh`; Create `src/lib/server/__tests__/sunset-product.test.ts`.

**Interfaces:** Consumes ProviderResult; produces catálogo independente de preço e derivados opcionais. Registrar consumidores adicionais encontrados antes de ampliar o patch.

- [ ] Escrever fixtures: PC ausente e eBay ausente mantêm catálogo; asking só aparece como preço anunciado; forecast/ROI/ranking vendido ficam indisponíveis; stale não recebe timestamp novo; identidade/condição/moeda erradas rejeitadas; nenhum zero inventado.
- [ ] Testar cenários específicos abaixo e confirmar falhas antes de editar produto.
- [ ] Adaptar os arquivos listados e respectivos componentes consumidores seguindo padrões existentes e ADR; manter referências manuais identificadas.
- [ ] Rodar `npx vitest run src/lib/server/__tests__/sunset-product.test.ts` e `npx vitest run tests/lib/domain/provider-policy.test.ts scripts/__tests__/ebay-observation.test.ts`; confirmar PASS, revisar e commitar arquivos explícitos.

### Task 4: Sunset de entrypoints, rollout e revisão

**Files:** Modify apenas scripts/jobs PC identificados na ADR após revisão; Create `tests/sunset/no-pricecharting.test.ts`, `docs/architecture/sunset-runbook.md`. Não ler workflow com segredo embutido; o responsável fornece versão sanitizada antes de patch.

**Interfaces:** Consumes política de publicação; produces nenhum outbound PC em build/runtime com modo sunset e runbook reversível. Schedules externos são tarefa operacional separada.

- [ ] Escrever teste que intercepta fetch e falha em domínios PC/SportsCardsPro; executar build sem credenciais com mocks locais; confirmar catálogo sem recomendações indevidas e rollback mantendo PC bloqueado.
- [ ] Preparar patch de entrypoints e schedules dedicados; jobs mistos mantêm eBay. Não executar dispatch/importação/retrain.
- [ ] Executar `npx vitest run tests/sunset/no-pricecharting.test.ts` e `npm run verify` em checkout completo sem segredos/produção; confirmar exit 0. Build não pode depender de chamadas reais.
- [ ] Revisar diffs de implementação, manifesto de licença, políticas de quota e teste de falha geral. Commit por caminho explícito com trailer exigido. Apresentar resultados e bloqueios antes de pedir autorização de push/deploy.

## Testes específicos do produto

- Resposta Browse de três anúncios nunca grava medianSoldPrice/soldCount/ebay-sold; activeListingCount não alimenta soldComps90d/liquidez. 429 não grava zero ou timestamp novo. LEGO set correto porém usado, caixa vazia e lote são rejeitados para new-sealed; MSRP e histórico sintético não viram observação de venda.

## Gates de conclusão

Plano é artefato documental, tarefas não executadas. Confirmar revisão do desenho/plano antes de código. Nenhuma autorização de apagar artefatos, implantar, comprar serviços ou alterar conta está implícita. Revisão documental: links relativos, caminhos existentes versus propostos, consistência dos tipos, cobertura da ADR e ausência de promessas de acesso/quota.
