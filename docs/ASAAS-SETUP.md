# Asaas — ligar o dinheiro de verdade

O Leeva tem **duas metades** de dinheiro:

| Metade | O que é | Estado do código |
|---|---|---|
| **Entrando** | restaurante compra crédito via Pix | ✅ pronto (este doc) |
| **Saindo** | repasse Pix pro motoboy no fechamento diário | ✅ pronto desde a Fase 4 |

Enquanto **não houver** `ASAAS_API_KEY` no ambiente, tudo roda em **modo simulação**
(crédito entra na hora, repasse é marcado como "SIMULADO"). Nada quebra.

---

## Passo a passo (produção)

### 1. Conta Asaas aprovada
A conta precisa estar **verificada** (documentos da empresa / CNPJ). Enquanto
não aprovarem, a conta só move dinheiro no modo teste.

### 2. Chave de API
Painel Asaas → **Configurações → Integrações → API** → gerar chave.

- **Para a metade "entrando" (cobrança)**: a chave **não** precisa de permissão de saque.
- **Para a metade "saindo" (repasse ao motoboy)**: aí sim marque
  "Permitir operações de saque via API".

Recomendado: **duas chaves separadas** — uma só de cobrança, outra de saque —
mas uma só com saque também funciona.

### 3. Variáveis no ambiente (Vercel → projeto `leeva-restaurante` → Settings → Environment Variables)

| Nome | Valor | Para quê |
|---|---|---|
| `ASAAS_API_KEY` | a chave da Asaas (`aact_...`) | liga cobrança + repasse |
| `ASAAS_ENV` | `production` (ou `sandbox` p/ teste) | qual servidor da Asaas usar |
| `ASAAS_WEBHOOK_TOKEN` | um texto secreto que **você inventa** (ex.: 30 caracteres aleatórios) | valida que o aviso de pagamento veio mesmo da Asaas |

Sem `ASAAS_WEBHOOK_TOKEN` o webhook recusa tudo (503) de propósito.

### 4. Webhook no painel Asaas
Painel Asaas → **Configurações → Integrações → Webhooks** → adicionar:

- **URL**: `https://leeva-restaurante.vercel.app/api/webhooks/asaas`
- **Token de autenticação**: o mesmo valor de `ASAAS_WEBHOOK_TOKEN`
- **Eventos**: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`,
  `PAYMENT_DELETED`, `PAYMENT_REFUNDED`
- **Versão da API**: v3

### 5. Teste de ponta a ponta (com dinheiro real, valor baixo)
1. No painel do restaurante → **Créditos** → comprar o menor pacote.
2. Aparece um código Pix copia-e-cola. Pague no seu banco.
3. Em alguns segundos o saldo sobe sozinho e a tela mostra "Pagamento confirmado".
4. Confira no painel Asaas que o pagamento entrou.

Se o saldo não subir: painel Asaas → Webhooks → ver as tentativas de entrega
(status e resposta). Erro 401 = token errado. Erro 503 = `ASAAS_WEBHOOK_TOKEN`
não configurado na Vercel.

---

## Como testar sem risco (sandbox)

```
npm run test:asaas
```

Não toca a Asaas — usa um cliente fake. Cobre: compra simulada, cobrança
pendente que não credita antes do pagamento, webhook que credita, webhook
duplicado que **não** credita de novo (idempotência), bônus, Pix vencido.

Requer a migration `supabase/migrations/0031_asaas_credit_purchases.sql`
aplicada no banco.

---

## Onde está no código

| Arquivo | Papel |
|---|---|
| `packages/shared/src/services/asaas.ts` | cliente HTTP da Asaas (cobrança + transferência) |
| `packages/shared/src/services/credit-purchase.ts` | fluxo da compra de crédito |
| `apps/restaurante/app/api/credits/route.ts` | inicia a compra |
| `apps/restaurante/app/api/webhooks/asaas/route.ts` | recebe a confirmação de pagamento |
| `apps/restaurante/app/(app)/creditos/CreditsClient.tsx` | tela (mostra o Pix, aguarda confirmar) |
| `packages/shared/src/services/driverpayouts.ts` | repasse Pix ao motoboy (metade "saindo") |

## Taxas (conferir no seu contrato Asaas)
- Recebimento Pix: uma % por transação.
- Transferência Pix (repasse ao motoboy): valor fixo por transferência.

Hoje o valor pago pelo restaurante = crédito liberado (1:1). A margem da
plataforma e o repasse dessas taxas entram em `credit-purchase.ts` na
variável `gross` quando você decidir a precificação.
