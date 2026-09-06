# Rotas reais (distância / tempo / ETA)

## Como está hoje

Sem nenhuma configuração, o Leeva calcula distância e tempo **em linha reta ×1,3**
(fator de rua). Serve pro MVP, mas:

- superestima entregas onde a rua faz volta, subestima onde é reto;
- o ETA mostrado ao cliente e a tarifa cobrada saem de uma aproximação, não
  do trajeto real.

`RoutingService` (`packages/shared/src/services/routing.ts`) isola isso — trocar
o provedor não mexe em nenhuma regra de negócio. Todos os provedores reais têm
**fallback automático** pra linha reta se falharem (rede, rate limit, ponto sem
via), então ligar um provedor real nunca "quebra" o cálculo, só melhora.

Ordem de preferência em `getRoutingService()`: **OSRM** (se `OSRM_BASE_URL`) →
**Mapbox** (se `MAPBOX_TOKEN`) → linha reta.

---

## Opção A — Mapbox (recomendada pra começar)

**Prós:** você só cria uma conta e pega um token — sem servidor pra manter. O
**mesmo token** também troca os tiles do mapa (hoje OpenStreetMap) por Mapbox,
mais bonito. Free tier: **100.000 requisições/mês** de rotas (com o cache
interno de 5 min, sobra folga pra um volume bem alto de entregas).

**Contras:** precisa de cartão no cadastro (não cobra dentro do free tier);
acima disso é ~US$ 2 / 1.000 requisições.

### Passo a passo

1. Conta em https://account.mapbox.com/ → aba **Tokens** → copie o
   **Default public token** (começa com `pk.`).
2. Na Vercel, nos **3 projetos** (`leeva-restaurante`, `leeva-motoboy`,
   `leeva-admin`) → Settings → Environment Variables → adicione
   `MAPBOX_TOKEN` = o token, ambiente **Production** (e Preview se quiser).
3. Redeploy (ou só aguarde o próximo push). Pronto — rotas e tiles passam a
   ser reais.

> A tela **Integrações** do painel passa a mostrar "Rotas / mapas:
> IMPLEMENTADO ✅".

---

## Opção B — OSRM próprio (mais barato em escala, mais trabalho)

Rodar sua própria instância do [OSRM](https://project-osrm.org/). Sem custo por
requisição, sem limite — só o custo do servidor (~US$ 5–10/mês num VPS pequeno).

> **Não use `https://router.project-osrm.org`** em produção — é um servidor de
> demonstração do projeto, com rate limit e proibido pra uso comercial pelos
> termos deles. Serve só pra teste rápido.

### Passo a passo (Docker, ~1–2 h na primeira vez)

```bash
# 1. baixar o mapa do Brasil (~1,5 GB)
wget https://download.geofabrik.de/south-america/brazil-latest.osm.pbf

# 2. pré-processar (perfil de carro) — usa bastante RAM/CPU, uma vez só
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/brazil-latest.osm.pbf
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-partition /data/brazil-latest.osrm
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-customize /data/brazil-latest.osrm

# 3. subir o servidor
docker run -d --restart unless-stopped -p 5000:5000 -v "${PWD}:/data" \
  ghcr.io/project-osrm/osrm-backend \
  osrm-routed --algorithm mld /data/brazil-latest.osrm
```

Depois: `OSRM_BASE_URL=http://SEU_IP:5000` (ou atrás de um domínio/HTTPS) nas
env vars da Vercel, nos 3 projetos.

Se só operar em uma região (ex.: Paraíba), dá pra baixar só o estado
(`https://download.geofabrik.de/south-america/brazil/paraiba-latest.osm.pbf`) e
o processamento fica trivial.

---

## Opção C — não fazer nada

A linha reta ×1,3 continua funcionando. Vale enquanto o volume for baixo e
ninguém reclamar do ETA. Suba pra Opção A quando tiver o primeiro cliente
pagando de verdade.

---

## Resumo

| | Custo | Trabalho | Quando |
|---|---|---|---|
| **Mapbox** | grátis até 100k/mês | 10 min (criar token) | assim que quiser precisão / mapa bonito |
| **OSRM próprio** | ~US$ 5–10/mês (VPS) | 1–2 h (uma vez) | quando o volume passar do free tier do Mapbox |
| **Linha reta** | grátis | nenhum | MVP / volume baixo |
