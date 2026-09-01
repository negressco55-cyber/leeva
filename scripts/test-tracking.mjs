/**
 * Testes do Bloco 4 — comunicação automática com o cliente + rastreamento
 * público. Fixtures [TRK], limpa no fim.
 *
 * Uso: node --import tsx --env-file=apps/restaurante/.env.local scripts/test-tracking.mjs
 */
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {
  createOrderFromNormalized,
  ensureSubscription,
  changePlan,
  addCredit,
  advanceOrderStatus,
  runDispatchTick,
  acceptOffer,
  getPublicTrackingSnapshot,
  ensureTrackingToken,
  trackingUrl,
} from '../packages/shared/src/services/index.ts';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let pass = 0,
  fail = 0;
const t = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (e) {
    console.log(`  ✗ ${name}\n    ${e.message}`);
    fail++;
  }
};
const cleanup = [];

async function main() {
  const { data: r } = await db
    .from('restaurants')
    .insert({ name: '[TRK] R', latitude: -7.115, longitude: -34.845, fleet_mode: 'leeva', onboarding_completed: true })
    .select('id')
    .single();
  cleanup.push(() => db.from('restaurants').delete().eq('id', r.id));
  cleanup.push(() => db.from('credit_ledger').delete().eq('restaurant_id', r.id));
  cleanup.push(() => db.from('restaurant_credits').delete().eq('restaurant_id', r.id));
  cleanup.push(() => db.from('tracking_tokens').delete().eq('restaurant_id', r.id));
  cleanup.push(() => db.from('notifications').delete().eq('restaurant_id', r.id));

  await ensureSubscription(db, r.id, 'pro');
  await changePlan(db, r.id, 'pro');
  await addCredit(db, r.id, 500, 'purchase', '[TRK] saldo');
  // desliga agrupamento p/ não interferir
  await db.from('payout_policies').insert({
    restaurant_id: r.id,
    name: '[TRK] sem agrupamento',
    active: true,
    config: { base: 5, per_km: 1.5, free_km: 2, min_payout: 6, group_max_stops: 1 },
  });
  cleanup.push(() => db.from('payout_policies').delete().eq('restaurant_id', r.id));

  const mkOrder = async () => {
    const res = await createOrderFromNormalized(db, r.id, {
      externalId: null,
      source: 'manual',
      customer: { name: 'Maria Cliente', phone: '5583999990000' },
      items: [],
      address: { formatted: 'Rua Teste - Bessa', latitude: -7.105, longitude: -34.84, region: 'Bessa' },
      total: 0,
      deliveryFee: 0,
      paymentMethod: 'online',
      paymentStatus: 'paid',
    });
    assert.ok(res.ok, res.error);
    cleanup.push(() => db.from('orders').delete().eq('id', res.orderId));
    return res.orderId;
  };

  let oid, token;

  await t('criação do pedido gera token de rastreamento', async () => {
    oid = await mkOrder();
    const { data: tok } = await db.from('tracking_tokens').select('token').eq('order_id', oid).maybeSingle();
    assert.ok(tok?.token, 'token não criado na criação do pedido');
    token = tok.token;
  });

  await t('ensureTrackingToken é idempotente', async () => {
    const again = await ensureTrackingToken(db, oid);
    assert.equal(again, token);
  });

  await t('snapshot público: passos, não cancelado, sem dados sensíveis', async () => {
    const res = await getPublicTrackingSnapshot(db, token);
    assert.ok(res.ok, res.ok ? '' : res.error);
    const s = res.snapshot;
    assert.equal(s.cancelled, false);
    assert.ok(Array.isArray(s.steps) && s.steps.length >= 4);
    assert.ok(s.restaurantName);
    // não expõe custo/telefone
    assert.ok(!('driver_payout' in s) && !('leeva_fee' in s));
  });

  await t('status → preparando: notifica o cliente com link de rastreamento', async () => {
    const res = await advanceOrderStatus(db, oid, 'preparing', { actorType: 'restaurant' });
    assert.ok(res.ok, res.error);
    const { data: n } = await db
      .from('notifications')
      .select('template, body, data, recipient_type')
      .eq('order_id', oid)
      .eq('recipient_type', 'customer')
      .eq('template', 'customer.confirmed')
      .maybeSingle();
    assert.ok(n, 'notificação do cliente não criada');
    assert.ok(n.data?.tracking_url?.includes('/track/'), 'link de rastreamento ausente nos dados');
  });

  await t('aceite da oferta: cliente é avisado que o entregador está a caminho', async () => {
    const { data: d } = await db
      .from('motoboys')
      .insert({
        restaurant_id: null,
        fleet: 'leeva',
        full_name: 'João Entregador Silva',
        phone: `trk${Math.random()}`.slice(0, 15),
        status: 'available',
        current_latitude: -7.115,
        current_longitude: -34.845,
        location_updated_at: new Date().toISOString(),
        rating: 4.9,
        deliveries_total: 20,
        deliveries_completed: 20,
        deliveries_late: 0,
        approval_status: 'approved',
        terms_accepted_version: 1,
      })
      .select('id')
      .single();
    cleanup.push(() => db.from('motoboys').delete().eq('id', d.id));

    await db.from('orders').update({ status: 'ready', dispatch_state: 'searching' }).eq('id', oid);
    await runDispatchTick(db, r.id);
    const { data: off } = await db
      .from('dispatch_attempts')
      .select('id, motoboy_id')
      .eq('order_id', oid)
      .is('responded_at', null)
      .maybeSingle();
    assert.ok(off, 'sem oferta');
    const acc = await acceptOffer(db, off.id, off.motoboy_id);
    assert.ok(acc.ok, acc.error);

    const { data: n } = await db
      .from('notifications')
      .select('template')
      .eq('order_id', oid)
      .eq('template', 'customer.driver_assigned')
      .maybeSingle();
    assert.ok(n, 'notificação "entregador a caminho" não criada');

    // snapshot agora mostra o entregador só com o primeiro nome
    const res = await getPublicTrackingSnapshot(db, token);
    assert.ok(res.ok);
    assert.equal(res.snapshot.driver?.name, 'João');
  });

  await t('token inválido → erro tratado', async () => {
    const res = await getPublicTrackingSnapshot(db, 'nao-existe-esse-token');
    assert.equal(res.ok, false);
    assert.equal(res.code, 404);
  });

  await t('trackingUrl monta a URL pública', () => {
    assert.ok(trackingUrl('abc').endsWith('/track/abc'));
  });
}

main()
  .catch((e) => {
    console.error(e);
    fail++;
  })
  .finally(async () => {
    for (const c of cleanup.reverse()) {
      try {
        await c();
      } catch {
        /* ignora */
      }
    }
    console.log(`\n${pass} passaram, ${fail} falharam`);
    process.exit(fail ? 1 : 0);
  });
