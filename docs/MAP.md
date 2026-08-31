# Mapa — central de operações (Fase 3)

## Arquitetura desacoplada

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| **MapProvider** | `services/map.ts` | tiles + geocoding. `OsmMapProvider` (OSM tiles + Nominatim, **sem chave**) IMPLEMENTADO; `MapboxMapProvider` PREPARADO (`MAPBOX_TOKEN`). |
| **RoutingService** | `services/routing.ts` (Fase 2) | distância / tempo / rota. `StraightLine` (estimativa) ou `OSRM` (`OSRM_BASE_URL`). |
| **dados do mapa** | `services/mapdata.ts` | monta o snapshot da central para o restaurante |
| **componente** | `apps/restaurante/app/(app)/_lib/LeevaMap.tsx` | Leaflet client-side (dynamic import), marcadores em pino, popups, heat, `invalidateSize` |

Trocar de provedor = mudar `getMapProvider()` / `getRoutingService()`. A UI recebe
só `{ tileUrl, attribution }` (nada de segredo).

## Visão do restaurante (`getMapData`)

Mostra:
- **restaurante** (ponto de coleta)
- **pedidos ativos** — marcador por pedido, cor pelo estado:
  amber = buscando entregador · azul = a caminho · verde = em entrega ·
  vermelho (outline) = atrasado
- **posição do entregador** — SÓ do entregador responsável por um pedido
  `picked_up`/`in_route` deste restaurante, e SÓ o primeiro nome, e SÓ se a
  localização for < 5 min

**Nunca** expõe: a rede de entregadores, telefone de entregador, posição de quem
não está numa entrega deste restaurante. Testado em `scripts/test-fase3.mjs`
("mapa do restaurante: NÃO expõe a rede").

## Integração mapa ↔ pedidos (bidirecional)

- clicar num pedido da lista → `focusId` → `LeevaMap` centraliza e abre o popup
- clicar no marcador → popup com #, cliente, região, status, ETA

## Heatmap (`getHeatmap`) — plano Pro+

- **pontos**: coordenadas reais dos pedidos do período (`today/7d/30d`)
- **regiões**: concentração (`share`), tempo médio, taxa de atraso, hora de pico
- **insights determinísticos** sobre os dados reais:
  - "🔥 Bessa concentra 31% das suas entregas, com pico às 20h"
  - "⚠️ Cabo Branco tem tempo médio 28% acima da sua média"
  - "💡 Considere manter capacidade extra em Bessa entre 19h e 22h"

Nada inventado — se não há dados, diz "Demanda bem distribuída".

## Geocoding

`GET /api/geocode?q=<endereço>` (autenticado) → `{ latitude, longitude, label }`.
Usado no formulário de nova entrega e no onboarding. Nominatim tem rate limit
(~1 req/s, uso justo) — para produção séria, usar provedor pago; a interface
não muda.
