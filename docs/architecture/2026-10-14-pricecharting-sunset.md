# ADR — Sunset PriceCharting: BricksFuture

Status: comportamento aprovado; implementação pendente de revisão do plano. Base auditada: `e3486b45`.

## Decisão aprovada e alcance

O usuário aprovou manter catálogo, busca, ofertas e calculadoras manuais existentes; mostrar fonte e horário; suspender previsões/rankings que dependam de vendas reais sem fonte válida. Esta autorização cobre planejamento e commits documentais, não implementação, push, deploy, contratos, deleção, credenciais ou produção. Esta ADR é contexto permanente solicitado pelo usuário, não plano efêmero de sessão.

Alternativas consideradas: usar asking como valor de mercado (rejeitada: semântica falsa); manter PC antigo como atual (rejeitada: frescor e licença); modo de anúncios com degradação explícita (adotado). Fonte vendida autorizada poderá ser adicionada futuramente, sem pressupor Marketplace Insights.

## Calendário e responsáveis

Assinatura termina em **22/10/2026**, segundo mensagem de Tulio. Horário e fuso contratual exatos são **desconhecidos**; não consultar conta ou segredos para inferi-los. Meta operacional proposta: concluir preparação e validação até **20/10/2026 00:00 UTC**, dois dias de calendário antes da data informada, sem garantia de 48 horas contratuais. Responsável pelo produto confirma janela de corte e autoriza rollout. Executor mantém um escritor por repo; reviewer verifica cada entrega. Não há execução agendada por este documento.

## Contrato de fornecedores proposto

Criar `src/lib/domain/price-observation.ts` com `PriceObservation`: `provider`, `kind: asking|sold|reference`, `productId`, `amount` positivo finito, `currency`, `condition`, `grade` e `gradingCompany` opcionais, `observedAt`, `fetchedAt`, `sampleSize` e `matchEvidence`. `ProviderResult` discrimina `available`, `stale`, `unavailable` com motivos `missing-config|auth|quota|timeout|network|no-match|invalid-data|license-unverified`. Não incluir tokens, dados de usuário ou URLs autenticadas em logs/evidência.

`evaluateObservation(observation, policy, now)` retorna ProviderResult; `isForecastAnchor(result)` só aceita resultado available do tipo sold, correspondência exata, licença publicável, condição compatível e amostra válida. Nunca converter asking/reference em sold. Preço indisponível é null, nunca zero. Catálogo não exige preço. Dados vendidos agregados requerem amostra e período; coleta de um anúncio não é data de venda.

Compartilhar inicialmente contrato/fixtures e transporte eBay; extrair pacote só após dois consumidores comprovarem compatibilidade. Matching e modelos permanecem por produto. Não criar monorepo nesta migração.

## Publicação, frescor e matching

UI: “Preço anunciado no eBay”, moeda, condição/grade, horário da coleta e tamanho da amostra; quando faltam dados, “Preço indisponível”. Dados antigos só aparecem como antigos se houver permissão de publicação. Sem uma fonte legítima, ocultar BUY/HOLD/SELL, ROI previsto, forecast, ranking por valorização e liquidez vendida; catálogo e links continuam navegáveis. Inputs manuais são identificados como fornecidos pelo usuário.

Proposta técnica de idade máxima para anúncios: **24 horas**, configurável por política e sujeita à validação dos termos eBay antes do rollout. Nunca estender limite imposto pelo fornecedor. `fetchedAt` não substitui `observedAt`; releitura de cache, 304, erro e atualização parcial não rejuvenescem preço. Chave de cache inclui provider/kind/mercado/moeda/condição/grade/versão de matching. Cache legado sem proveniência é inelegível para valuation; preservá-lo sem consumi-lo publicamente até revisão. Resposta vazia bem-sucedida difere de falha; nenhuma apaga o último registro válido ou o marca atual.

Cartas: identidade inclui set/ano, número, idioma, variante/paralela, jogador/personagem, grade e certificadora; rejeitar lotes, réplicas, acessórios, raw versus slab e correspondência apenas por nome. LEGO: set number exato, edição e new-sealed versus usado/incompleto/caixa vazia/lote. Converter moeda apenas com fonte/cotação/data explícitas; caso contrário separar moedas.

## Transporte e orçamento

Deadline inicial de **10 s** por requisição com AbortSignal, inclusive OAuth. Uma renovação após 401, segundo 401/403 é auth terminal. 429 respeita Retry-After válido e abre cooldown compartilhado; sem retry imediato ou job por produto insistente. Orçamento por app/keyset e ambiente, não presumir quota por site; deduplicar concorrência e limitar paginação. Quota efetiva e acesso de produção são gates de rollout, sem credenciais nos documentos. Health expõe estado sanitizado do fornecedor, não só presença de variável; liveness permanece separada de readiness.

## Inventário e gates de retenção/deleção

Antes de alterar consumo, produzir manifesto de catálogos/IDs, preços atuais, CSV/snapshots, históricos, imagens espelhadas, overrides, modelos derivados e caches, com caminho/chave, origem, licença comprovada, uso público e dependentes. Não ler dados privados nem exportar bancos. Inventário remoto exige escopo e autorização separados. Imagens precisam de direito próprio, não presumir que licença de preço cobre mídia. Modelos treinados com PC não ficam automaticamente liberados após remover chamadas.

Sem prova de licença, planejar retirada reversível da publicação, preservando os artefatos existentes; não apagar, sobrescrever ou importar novamente. Deleção exige inventário revisado, confirmação do titular, escopo exato e plano de recuperação aprovado. Não pedir nem registrar segredos como prova.

## Rollout e rollback propostos

1. Fixtures offline e modo degradado atrás de política reversível; comparar páginas sem publicar alterações.
2. Revisão por produto, confirmação de licença/quotas e autorização específica de push e deploy. Canary somente após essa autorização.
3. Desligar chamadas PC/SportsCardsPro nos entrypoints e desativar schedules dedicados no patch futuro; jobs mistos preservam eBay. Bloquear chamadas PC em build/runtime. Responsável verifica schedulers externos sem executar importação.
4. Verificar navegação, preços rotulados, ausência de recomendações inválidas e ausência de chamadas PC. Métricas: auth/quota/timeout/no-match/stale, chamadas e cache hits, sem dados pessoais.
5. Rollback restaura versão de apresentação/contrato mantendo bloqueio PC. Não reativar assinatura expirada, forecasts inválidos ou gravação de anúncios como vendas. Falha geral eBay mantém catálogo e estado indisponível.

## Fontes verificadas e incertezas

- [Browse](https://developer.ebay.com/api-docs/buy/static/api-browse.html): descoberta de anúncios; não prova vendas realizadas.
- [Marketplace Insights](https://developer.ebay.com/api-docs/buy/static/ref-marketplace-supported.html): restrita, fechada a novos usuários; nenhum acesso destas aplicações comprovado.
- [Produção Buy APIs](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html): elegibilidade/aprovação; cadastro gratuito não é aprovação.
- [Quotas oficiais](https://developer.ebay.com/develop/get-started/api-call-limits): número efetivo não confirmado na auditoria por erro da página. Não prometer 5.000/dia.
- [Termos PC](https://www.pricecharting.com/page/terms-of-service), [guia](https://www.pricecharting.com/page/guide-terms-of-service): propriedade/restrições de redistribuição; retenção e publicação pós-assinatura sem prova.
- [API PC](https://www.pricecharting.com/api-documentation): API/CSV de valores atuais, sem histórico de preços/vendas. Revalidar termos antes de implementar; não repetir pesquisa ampla sem alteração relevante.

## Arquitetura e diferenças deste produto

- Identidade confirmada pelo README: legofuture serve bricksfuture.com.
- Catálogo: Rebrickable e catálogo embarcado; enriquecimento Brickset/BrickLink tem permissões e disponibilidade próprias. Não converter esses serviços em dependências obrigatórias do modo eBay.
- `scripts/sync-ebay-sold-listings.mjs` consulta Browse FIXED_PRICE e grava medianSoldPrice/soldCount/ebay-sold: são anúncios, não vendas.
- `scripts/sync-ebay-comps.mjs` grava anúncios em soldComps90d; `src/lib/domain/lego-forecast.ts` usa esse campo em liquidez. Falha vira zero no script. Introduzir campos novos; consumidores rejeitam os legados ambíguos.
- `src/lib/domain/lego-forecast.ts` usa preço PC e fallback MSRP/sintético. MSRP é referência, nunca preço observado ou âncora vendida.
- Cache `src/lib/db/cache.ts` e histórico `src/lib/db/lego-history.ts`: TTL de cache não define idade da observação. Histórico exige condição e row.price; linhas ebay-sold têm outro formato, rastrear consumidores antes de migrar.
- Jobs PC: `scripts/sync-pricecharting-to-dynamo.mjs`, `scripts/sync-pricecharting-csv.mjs`, `scripts/scrape-pricecharting-history.mjs`, `scripts/sync-all.sh`. Revisar backfill-current-month-history e synthesise-sparse-history para impedir histórico fabricado.
- Modelos: `src/lib/db/bundled/lego-forecast-*.json`, `lego-ml/` e `infra/lego-ml-retrainer/` requerem inventário de treinamento/licença; não executar upload/retrain/deploy.
- Branches lf-plan-a-ingest, lf-plan-b-ml-infra e lf-plan-c-scale-ux precisam de comparação antes da implementação. Sem PR aberta na auditoria.

## Sequência de implementação

Ver [plano executável](../superpowers/plans/2026-10-14-pricecharting-sunset.md). Ordem entre produtos: Pokefuture (contrato), BricksFuture (corrigir semântica de ingestão antes de reusar), SoccerCardsFuture (separar identidade de preços). Correção emergencial LEGO pode ser revisada separadamente, sem acionar jobs.
