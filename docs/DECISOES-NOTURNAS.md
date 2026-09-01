# Decisões noturnas — sessão autônoma (2026-08-31 → 01/09)

Registro das decisões tomadas sem validação humana durante a execução autônoma
dos blocos B, C, 4, 5 e do redesign. Cada item: o que estava ambíguo, o que
decidi e por quê. O usuário revisa de manhã.

Regra seguida: travar só em mudança de arquitetura ou algo irreversível/arriscado.
Nunca tocar em Asaas produção nem integração iFood.

---

## Bloco B — Notificação push ✅

**Feito:**
- Migration `0026_fase5_push_subscriptions.sql`: tabela `push_subscriptions`
  (1 linha por dispositivo), coluna `motoboys.push_enabled`.
- `packages/shared/src/services/push.ts` — Web Push real via lib `web-push`
  + VAPID. Remove assinatura morta (404/410) automaticamente.
- `notify-driver.ts` — helper único `notifyDriver()` (in-app + push).
- Service worker `apps/motoboy/public/sw.js` (push + clique).
- `NotificationSetup.tsx` na tela de Status: cartão claro pedindo permissão,
  auto-dispara quando o motoboy fica online; some quando ativo (deixa só
  "🔔 Notificações ativas — enviar teste").
- Gatilhos de push: nova oferta (autodispatch), entrega cancelada após
  aceite (orders.advanceOrderStatus), repasse pago/falhou (driverpayouts).
- Chaves VAPID geradas e configuradas na Vercel (projeto leeva-motoboy) e
  no `.env.local`. Valores não expostos no chat.

**Decisões tomadas sozinho:**
1. **Permissão pedida ao ficar online, não no cadastro.** O prompt original
   dizia "peça permissão claramente no primeiro 'available'". Implementei
   exatamente isso: o cartão aparece na tela de Status e o `requestPermission`
   dispara automaticamente quando `status !== 'offline'`. Antes disso o
   cartão fica visível mas sem forçar o pop-up.
2. **Repasse pago/falhou = só push, sem in-app.** A tabela `notifications`
   exige `restaurant_id` (NOT NULL) e um repasse não tem restaurante único.
   Em vez de migração para afrouxar a coluna (mudança de schema com impacto
   em RLS), o aviso de repasse vai só por push — a tela Pagamentos já mostra
   o histórico de repasses de qualquer jeito.
3. **web-push como lib de envio** (padrão de mercado, sem serviço pago).
   Sem provedor VAPID configurado, `sendPushToMotoboy` vira no-op explícito
   (`skipped:true`) — nada finge que enviou.
4. **Sem cache offline no service worker** por enquanto — só o canal de
   notificações. PWA installability plena fica pro redesign (Parte 2).

**Não testável 100% sem device real:** o envio de verdade depende de uma
subscription gerada por um navegador. Os testes cobrem toda a lógica de
banco/erro; o `POST /api/push/test` permite o usuário confirmar no celular.
