# Resumo da noite — 31/08 → 01/09/2026

Sessão autônoma. Objetivo: fechar os blocos de funcionalidade que faltavam
(B, C, comunicação com o cliente, rota real) + o redesign dos 3 apps, sem
parar para validação. Detalhe de cada decisão em
[`DECISOES-NOTURNAS.md`](DECISOES-NOTURNAS.md).

## Tudo que ficou pronto

| Bloco | O que é | Estado |
|---|---|---|
| **B — Push** | Notificação Web Push no app do motoboy (nova oferta, cancelamento após aceite, repasse pago/falhou). Pede permissão ao ficar online. | ✅ no ar |
| **C — Agrupamento** | Despacho oferta 2+ pedidos vizinhos como uma rota só. 1ª parada = tabela cheia; parada extra = distância incremental (piso R$ 3,50, configurável). Recusa dissolve o grupo. | ✅ no ar |
| **Bloco 4 — Cliente** | Token de rastreamento criado na hora do pedido; link vai em toda notificação; página `/track/:token` pública e ao vivo; novo aviso "entregador a caminho". | ✅ no ar |
| **Bloco 5 — Rota real** | OSRM ligado com fallback automático para linha reta + cache. Distância de verdade nas contas de taxa. | ✅ no ar |
| **Parte 2 — Redesign** | Sistema de design novo ([`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md)) aplicado nos 3 apps: claro por padrão + escuro, verde no lugar do laranja, sem os clichês de IA. | ✅ no ar |

Tudo commitado e no GitHub (`main`). A Vercel reconstrói e publica sozinha a
cada push — os 3 apps já estão atualizados. Build de produção testado localmente
(passou nos 3).

## Commits da noite

```
Fase 5 (Bloco A): rede de motoboys self-service   (finalizado — resíduo de teste corrigido)
Fase 5 (Bloco B): notificações Web Push
Fase 5 (Bloco C): agrupamento de entregas com precificação incremental
Bloco 4: comunicação automática com o cliente + rastreamento público
Bloco 5: rota real via OSRM com fallback
Parte 2: redesign dos 3 apps sobre novo sistema de design
```

## Testes

Régua completa rodada no fim, tudo verde:

| Suíte | Resultado |
|---|---|
| unitários (`npm test`) | 34 / 34 |
| fase3 (despacho) | 14 / 14 |
| fase35 (admin, reputação) | 21 / 21 |
| fase4 (financeiro) | 18 / 18 |
| fase5 (rede + push) | 16 / 16 |
| fase5c (agrupamento) | 6 / 6 |
| tracking (cliente) | 7 / 7 |
| integração | 14 / 14 |
| concorrência | 7 / 7 |
| **total** | **137 / 137** |

Novos scripts: `npm run test:fase5c`, `npm run test:tracking`.
Typecheck e lint dos 3 apps: sem erro.

## Migrations aplicadas no banco

`0026` push_subscriptions · `0027` colunas de agrupamento + config ·
`0028` `credit_adjust` (ajuste de crédito com sinal).

## Configuração nova na Vercel (valores não expostos)

- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` /
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — no projeto `leeva-motoboy`.
- `LEEVA_TRACKING_BASE_URL` = `https://leeva-restaurante.vercel.app` — nos 3.
- `OSRM_BASE_URL` = `https://router.project-osrm.org` — nos 3.

## Como ficou cada tela principal (conferido no navegador, claro e escuro)

- **Login (todos os apps)** — fundo cinza-quente quase branco, cartão com
  borda fina sem sombra, botão verde "Entrar" (sem seta), rótulos em caixa
  normal. Limpo, parece ferramenta, não folheto.
- **Restaurante · Visão geral** — barra lateral branca com linha fina à
  direita, item ativo com leve fundo verde. Faixa de status verde no topo,
  linha de indicadores com números tabulares, mapa embaixo. Densa e calma.
- **Restaurante · Pedidos** — busca + 2 filtros no topo, lista abaixo. Botão
  "+ Nova entrega" no canto. Vazio quando não há pedido.
- **Admin · Visão geral** — segmento "Hoje / 7 / 30 dias / Mês" (ativo verde),
  cartão "Motor de despacho" com bolinha de status, grade de receita.
- **Admin · Restaurantes** — tabela com só divisórias horizontais, tag de
  status discreta, sem zebra nem linha vertical.
- **Motoboy · Status** — botão grande "Ficar online", dois cartões de número,
  cartão "Ative as notificações", tab bar de texto embaixo. Alvo de toque
  grande em tudo.
- **Motoboy · Oferta** (a única com sombra) — cartão que sobe na tela com
  borda-topo verde, cronômetro, e — quando é rota agrupada — a sequência de
  paradas com o valor de cada uma e o total.

## O que ficou pendente (e por quê)

1. **Notificação ao cliente não *chega* sozinha sem provedor externo.** Toda a
   tubulação está pronta (o link vai junto, a página é automática), mas
   WhatsApp Business API e SMS são pagos e iFood está fora do combinado. No
   segundo que você configurar `WHATSAPP_TOKEN` ou `TWILIO_*`, começa a enviar.
2. **"Pedido chegando" por GPS** (`delivery.nearby`) — precisa de um vigia de
   localização com histerese. Os outros 4 avisos (confirmado, a caminho, saiu,
   entregue) já funcionam.
3. **OSRM público tem rate limit.** Antes de volume real, subir uma instância
   própria (Docker + mapa do Nordeste) e trocar `OSRM_BASE_URL`. O fallback
   segura a onda se o público bloquear.
4. **Redesign — telas secundárias.** A linguagem visual nova está nos 3 apps,
   mas telas de config e sub-páginas ainda podem ser refinadas (algumas grades
   de indicadores têm "vários cartões iguais" que o design system pede para
   juntar). Dá para ir tela a tela sem mais mudança de base.
5. **Tela do restaurante não destaca "pedido agrupado com X e Y".** O valor
   cobrado já aparece certo; falta o rótulo visual.
6. **Continua fora** (pra quando você estiver por perto): Asaas produção,
   integração iFood, Sentry, backups, confirmação de e-mail.

## Dados de teste

Limpos. Rodei `scripts/cleanup-night.mjs` — restou só a demonstração
permanente: 1 restaurante (`Restaurante Demo Leeva`, login `dono@leeva.dev` /
`leeva123`), 12 motoboys demo, crédito inicial. 0 pedidos, 0 ofertas,
`terms_versions` só com a v1. As suítes de teste limpam as próprias fixtures.
