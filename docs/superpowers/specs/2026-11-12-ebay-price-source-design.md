# BricksFuture — eBay como fonte de preço (novembro 2026)

Status: aprovado pelo dono em 12/11/2026 ("O que você fez no PokeFuture, faz no
BricksFuture"). Replica as decisões tomadas para o PokeFuture em 10/11/2026
(`pokefuture/docs/superpowers/specs/2026-11-10-ebay-price-source-design.md`).

## Decisões do dono (herdadas do PokeFuture)

- A assinatura PriceCharting foi cancelada. Preços atuais vêm do eBay.
- Troca silenciosa: sem banner, sem rótulo "asking price". Preço é preço; só
  muda a fonte.
- Dados antigos do PriceCharting (preços de maio, histórico, gráficos) ficam no
  site e no DynamoDB. Nada é apagado.
- Forecast precisa considerar o preço atual, porque preço flutua.
- Buying lists ("Top Buys") são de novembro de 2026, não de setembro/outubro.
- Regra de preço aprovada: mediana eBay só com **>= 8 anúncios** e dentro de
  **0,5x–2x** do último preço conhecido; senão mantém o último preço conhecido.
  Nunca grava 0, NaN ou null.

## Estado encontrado

- O "sunset" de outubro (commits d80d613..86c47e1) tirou forecasts, rankings e
  preços do ar; o site mostra só catálogo.
- DynamoDB `legofuture-cache`: 4.444 linhas `PRICING#PRODUCT#{pcId}` sk=`v1`, todas
  do PriceCharting, última escrita 18/05/2026. Nenhuma linha BrickLink, Brickset
  ou eBay. 38 dos 50 sets curados têm produto + preço no DynamoDB; 12 usam só o
  preço curado de `sets.ts`.
- Score e sinal dos 50 sets curados são fixos em `sets.ts`; o preço não mexe
  no ranking.
- A chave eBay é a mesma do PokeFuture (cota ~5.000 chamadas/dia compartilhada;
  o PokeFuture usa ~350/dia às 06:00 UTC).

## Arquitetura

1. **Desfazer o sunset**: restaurar o código de `e3486b4` (pré-sunset) em
   `src/`, `tests/`, configs; apagar artefatos do sunset (retained, sunset
   catalog/policy, monthly readiness, pacote nativo). Scripts PriceCharting e
   derivados continuam desligados (a API não existe mais). Remover o fallback
   ao vivo do PriceCharting em `lego-estimate.ts` e `PRICECHARTING_API_TOKEN` do
   `amplify.yml`.
2. **Linha de preço eBay** no DynamoDB: `pk=PRICING#PRODUCT#{setNumber}`,
   `sk=ebay-median`, com `price` (decidido pela regra), `status`, `activeCount`,
   `p50`, `capturedAt`, `source:"ebay"`. `mergePricingRows` passa a usar
   `ebay-median.price` como `newPrice` com precedência sobre o PriceCharting.
   Todas as superfícies (catálogo, busca, top-buys, páginas) já passam por esse
   merge.
3. **Refresh diário** `scripts/refresh-ebay-prices.mjs`: Browse API, FIXED_PRICE,
   NEW, EBAY_US, categoria LEGO Complete Sets & Packs (19006), query
   `LEGO {setNumber}`, filtro pós-busca exige o número do set no título e exclui
   termos de não-set (minifig, instructions only, empty box, lot, custom, MOC,
   compatible, etc.). Lista de trabalho: os 50 sets curados todo dia + um rodízio
   do restante do catálogo com preço (mais antigos primeiro), limitado a 600
   chamadas por execução. `lastKnown` = `ebay-median.price` anterior ?? preço PC
   `new-price` ?? preço curado. Se nenhuma busca for aceita ou alguma requisição
   falhar por auth/quota, não grava nada e sai com erro.
4. **Agendamento**: GitHub Action diária às 07:00 UTC (uma hora depois do
   PokeFuture), com credenciais AWS via OIDC (role nova, só escrita/leitura na
   tabela) e secrets EBAY_CLIENT_ID/SECRET (mesma chave já usada no Amplify).
   Como o site lê o DynamoDB em runtime (ISR 1h + cache 5 min), não precisa de
   deploy por atualização.
5. **Forecast com preço atual**: sets com produto no DynamoDB já recebem o
   forecast ML calculado a partir do preço. Para o ranking, o score curado é
   ajustado pela variação do CAGR implícito (`proj5y/currentPrice`) entre o
   preço curado e o preço atual (peso 35% do CAGR na fórmula documentada), e o
   sinal cai para Watch/Hold quando o CAGR atual fica baixo. As buying lists e a
   home ordenam por esse score ajustado.
6. **Copy**: metodologia, privacidade e termos citam eBay para preço atual e
   PriceCharting para histórico. Sem banner.

## Fora de escopo

Retreinar o modelo ML; BrickLink/Brickset; mexer no PR #4 (patch de segurança
do Next de outra sessão).
