# Leeva — Sistema de Design

Guia único para a aparência dos 3 apps (restaurante, motoboy, admin).
O objetivo é uma interface **de ferramenta de trabalho**: gente usando com
pressa (cozinha no pico, motoboy na moto, operação olhando 5 coisas ao mesmo
tempo). Calma, densa de informação, sem enfeite.

> Este documento é a fonte da verdade. O CSS de cada app
> (`apps/*/app/globals.css`) implementa exatamente o que está aqui e reaproveita
> os mesmos nomes de classe. Mudou aqui → muda no CSS dos 3.

---

## 1. Princípios

1. **Legível antes de bonito.** Contraste alto, tipografia sóbria, hierarquia
   clara. Se precisa escolher entre "impressiona" e "lê rápido", lê rápido.
2. **Pouca cor.** Uma cor de marca, usada com parcimônia (ação principal e
   pouco mais). Verde. Status (ok/aviso/erro) têm suas cores e só aparecem
   quando há status.
3. **Elevação é exceção.** Nada de sombra em todo card. Sombra só em 3 lugares
   nomeados (§6). O resto se separa com fundo e linha de 1px.
4. **Sem caixa-alta.** Rótulos são texto pequeno em peso médio, nunca
   `TEXT-TRANSFORM: UPPERCASE`. O reset zera isso globalmente.
5. **Botão é texto.** Sem `→`, sem ícone dentro do rótulo, sem "Clique aqui".
   O verbo já diz o que acontece ("Salvar tabela", "Aprovar", "Ficar online").
6. **Zero gradiente decorativo.** Preenchimento chapado. Sempre.

### O que NÃO fazer (clichês de UI gerada por IA — proibidos)

- ❌ Fundo bege / terracota / "warm cream". O neutro do Leeva é cinza-quente
  quase branco (hue ~40°, saturação < 4%). Bege tem saturação alta demais.
- ❌ Todo container sendo um card branco com a mesma sombra e o mesmo raio.
- ❌ RÓTULOS EM CAIXA ALTA.
- ❌ Seta `→` em botão ("Continuar →", "Ver mais →").
- ❌ Gradiente de enfeite (header, botão, "hero", borda).
- ❌ Emoji como ícone de navegação em produção (ok em mensagem pontual).

---

## 2. Cor

Tokens em `:root` (tema claro) e sobrescritos em
`@media (prefers-color-scheme: dark)`.

### Claro (padrão)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#f7f7f5` | fundo da página (cinza-quente, **não** bege) |
| `--surface` | `#ffffff` | card, painel, linha de tabela |
| `--surface-2` | `#f1f1ee` | seção rebaixada, fundo de input, hover |
| `--text` | `#1b1b19` | texto principal |
| `--muted` | `#6a6a64` | texto secundário, rótulo |
| `--faint` | `#9b9b93` | placeholder, meta terciária |
| `--border` | `#e5e4df` | linha de 1px (padrão) |
| `--border-strong` | `#d2d1ca` | divisória de ênfase, borda de input |
| `--brand` | `#1f6f5c` | ação principal, links, foco |
| `--brand-hover` | `#1a5f50` | :hover da ação principal |
| `--brand-weak` | `#e7f1ee` | fundo tênue de destaque de marca |
| `--ok` | `#2f7d4f` / `--ok-weak` `#e6f2ea` | sucesso, "no prazo", pago |
| `--warn` | `#9a6b08` / `--warn-weak` `#f6ecd8` | atenção, aguardando |
| `--danger` | `#b3261e` / `--danger-weak` `#f8e5e3` | erro, atrasado, falhou |

### Escuro

| Token | Valor |
|---|---|
| `--bg` | `#141513` |
| `--surface` | `#1c1e1b` |
| `--surface-2` | `#242621` |
| `--text` | `#e9e9e4` |
| `--muted` | `#a3a39a` |
| `--faint` | `#6f6f66` |
| `--border` | `#31332e` |
| `--border-strong` | `#3d3f39` |
| `--brand` | `#4fae93` |
| `--brand-hover` | `#5cbfa2` |
| `--brand-weak` | `#1e2f2a` |
| `--ok` `#63b98a` / `--ok-weak` `#1b2a22` | |
| `--warn` `#d3a548` / `--warn-weak` `#2b2519` | |
| `--danger` `#e0685f` / `--danger-weak` `#2e1d1c` | |

(O verde de marca clareia no escuro para manter contraste AA sobre `--surface`.)

### Regras de contraste

- Texto principal sobre `--surface`: ≥ 7:1.
- Texto `--muted` sobre `--surface`: ≥ 4.5:1.
- Texto sobre `--brand` é sempre branco (`#fff`) no claro e quase-preto
  (`#10231d`) no escuro — o token `--on-brand` resolve isso.

---

## 3. Tipografia

Fonte: stack de sistema (`ui-sans-serif, system-ui, -apple-system, "Segoe UI",
Roboto, ...`). Sem webfont — carrega instantâneo e é familiar.

### Escala (px)

| Nome | Tamanho / linha | Peso | Uso |
|---|---|---|---|
| `--fs-label` | 12 / 1.3 | 600 | rótulo de campo, cabeçalho de tabela, meta |
| `--fs-meta` | 13 / 1.4 | 400 | texto secundário, legenda |
| `--fs-body` | 15 / 1.55 | 400 | corpo padrão |
| `--fs-subhead` | 18 / 1.35 | 600 | título de card, subtítulo |
| `--fs-title` | 22 / 1.25 | 600 | título de página |
| `--fs-display` | 28 / 1.15 | 650 | número grande de KPI, tela de status |

- Títulos: `letter-spacing: -0.01em`. Corpo: normal.
- **Nunca** `text-transform`. **Nunca** peso > 700.
- Números de dinheiro e métricas: `font-variant-numeric: tabular-nums`.

---

## 4. Espaçamento e layout

Escala: **4, 8, 12, 16, 24, 32, 48** (tokens `--s1`..`--s7`). Nada fora disso.

- Raio: `--r-sm` 6px (tag, input pequeno), `--r` 10px (card, botão), `--r-lg`
  14px (folha mobile, modal). Sem raio "pill" exceto em `.dot` e `.tag`.
- Largura de conteúdo: restaurante/admin `--w-content: 960px`; motoboy
  `--w-app: 480px`.
- Página respira: `padding` vertical de `--s6` (32) no desktop, `--s4` (16) no
  mobile.
- **Densidade variável**: listas operacionais (board de pedidos, fila de
  motoboys) são densas (`--s2`/`--s3`). Telas de leitura (detalhe, config) são
  arejadas (`--s4`/`--s5`).

---

## 5. Componentes

### Superfícies — e quando NÃO usar card

Três tratamentos, escolhidos pelo papel do conteúdo:

1. **`.card`** — fundo `--surface`, borda 1px `--border`, raio `--r`, **sem
   sombra**. Para um bloco autocontido que o olho trata como uma unidade
   (um formulário, um pedido no board, um painel de métrica).
2. **Seção rebaixada** (`.section` / `background: --surface-2`) — sem borda,
   só um respiro de fundo. Para agrupar sem "encaixotar".
3. **Divisória** (`.rows > * + *` com `border-top: 1px --border`) — para uma
   lista de itens homogênea (timeline, histórico, extrato). Zero card por item.

Regra: **no máximo um nível de card**. Card dentro de card é proibido — vira
seção rebaixada ou lista com divisória.

### `.card-title`

Título de card. `--fs-label` (12px), peso 600, cor `--muted`, **sem caixa
alta**, `margin-bottom: --s2`. É um rótulo, não um letreiro.

### Botões — `.btn` (restaurante/admin) e `.button` (motoboy)

| Variante | Fundo | Borda | Texto |
|---|---|---|---|
| primária (padrão) | `--brand` | — | `--on-brand` |
| `.secondary` | `--surface` | 1px `--border-strong` | `--text` |
| `.ghost` | transparente | — | `--brand` |
| `.danger` | `--danger` | — | `#fff` |

- Altura: 38px desktop / 48px mobile. `.sm` = 30px / 13px.
- Peso 550, raio `--r`, `padding-inline: --s4`.
- `:focus-visible` → `outline: 2px solid --brand; outline-offset: 2px`.
- `:disabled` → `opacity: .5; cursor: not-allowed`.
- **Sem** ícone/seta no rótulo.

### Input / select / textarea — `.input`

Fundo `--surface`, borda 1px `--border-strong`, raio `--r-sm`, `padding: 10px
12px`, `--fs-body` (16px no motoboy p/ não dar zoom no iOS). Foco: borda
`--brand` + `box-shadow: 0 0 0 3px --brand-weak`. Rótulo é um `<label>` com
texto `--fs-label` `--muted` acima do campo.

### Tabela — `.tbl`

Só divisórias horizontais (`border-bottom: 1px --border` nas `td`/`th`). Sem
borda externa, sem linhas verticais, sem zebra. `th`: `--fs-label`, `--muted`,
`text-align` conforme o dado. Célula: `padding: --s3 --s3`. Números à direita,
tabular.

### Status — `.tag`, `.dot`, `.op-alert`

- **`.tag`** — pílula de status. `background: var(--X-weak)`, `color: var(--X)`,
  sem borda, `--fs-label`, `padding: 2px 8px`, raio 999px. `X` ∈ ok/warn/danger
  /brand/neutro.
- **`.dot`** — bolinha 8px da mesma cor, para status inline em lista densa.
- **`.op-alert`** — faixa de aviso. Fundo `--X-weak`, borda-esquerda 3px
  `--X`, texto `--text`. Variantes `.ok` `.warning` `.critical`.

### KPI / métrica — `.stat`, `.kpi`, `.big`, `.lbl`

`.big` = `--fs-display`, tabular, peso 650. `.lbl` = `--fs-label` `--muted`.
Sem card individual por métrica numa linha de KPIs — usar uma `.card` só,
dividida por `--border` vertical fino, ou uma grade sem bordas.

### Navegação

- **Restaurante/admin**: barra lateral fixa (`--surface`, borda-direita 1px).
  Item ativo: fundo `--brand-weak`, texto `--brand`, sem barra/indicador
  extravagante. Texto sempre visível (ícone é opcional e decorativo).
- **Motoboy**: `.tabbar` fixa embaixo, 5 itens no máximo, **rótulo de texto
  sempre** (13px). Alvo de toque ≥ 56px de altura. Item ativo: texto `--brand`
  + peso 600.

### `.offer-card` (motoboy) — a única exceção de elevação

Flutua sobre a tela exigindo decisão. Fundo `--surface`, raio `--r-lg`,
`box-shadow: var(--shadow-pop)`, borda-superior 4px `--brand`. Cronômetro
grande. Botões "Recusar" (secondary) e "Aceitar" (primária) lado a lado,
ocupando a largura.

---

## 6. Elevação

Um único token: `--shadow-pop: 0 10px 34px -6px rgba(20,20,18,.22)`.
**Só** nestes três:

1. `.offer-card` (motoboy).
2. Modal / diálogo (`.dialog`).
3. Menu suspenso / popover.

Card, painel, header, tabela: **nunca** têm sombra.

---

## 7. Movimento

- Transição padrão: `150ms ease` em `background-color`, `border-color`,
  `color`, `opacity`, `transform`.
- `:active` em botão: `transform: translateY(1px)`.
- Entrada de `.offer-card`: `slide-up 180ms ease` + leve `scale(.98→1)`.
- Respeitar `@media (prefers-reduced-motion: reduce)` → sem transform, sem
  animação.

---

## 8. Acessibilidade

- Foco visível sempre (`:focus-visible` com anel `--brand`).
- Área de toque mínima 44px (motoboy: 56px nas ações principais).
- Cor nunca é o único sinal: status tem cor **e** texto/ícone-forma.
- `aria-live="polite"` em contadores que mudam sozinhos (ofertas, saldo).
- Contraste conforme §2.

---

## 9. Como aplicar (checklist de PR de redesign)

- [ ] `globals.css` do app reescrito com os tokens acima, **mantendo os nomes
      de classe já usados** (`.card`, `.btn`, `.input`, `.muted`, `.tag`,
      `.op-alert`, `.stat`, `.tbl`, `.page-head`, `.tabbar`, `.offer-*`...).
- [ ] Nenhum `text-transform: uppercase` (grep).
- [ ] Nenhum `→` / `&rarr;` em `<button>` (grep).
- [ ] Nenhum `linear-gradient` / `radial-gradient` decorativo (grep).
- [ ] Nenhuma sombra fora de `.offer-card`, `.dialog`, popover (grep `box-shadow`).
- [ ] Fundo da página = `--bg` (não branco puro, não bege).
- [ ] Telas principais conferidas no navegador nos 2 temas.
