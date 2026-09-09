/**
 * Testes do "você decide" — pedido segurado (dispatch_hold) do iFood.
 * Fixtures [HOLD], limpa no fim. Requer migration 0034.
 * Uso: node --import tsx --env-file=apps/restaurante/.env.local scripts/test-order-hold.mjs
 */
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {
  createOrderFromNormalized,
  callDriverForOrder,
  markOrderHandledExternally,
  closeIfoodOrder,
  getCreditBalance,
  addCredit,
  adjustCredit,
} from '../packages/shared/src/services/index.ts';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let pass = 0;
let fail = 0;
const cleanup = [];
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

const normalized = (n) => ({
  source: 'ifood',
  externalId: `hold-${n}-${Date.now()}`,
  customer: { name: '[HOLD] C', phone: null },
  address: { formatted: 'rua x', latitude: -7.116, longitude: -34.85 },
  items: [],
  total: 0,
  paymentMethod: 'online',
  paymentStatus: 'paid',
  notes: null,
});

const run = async () => {
  const { data: r } = await db
    .from('restaurants')
    .insert({ name: '[HOLD] R', latitude: -7.115, longitude: -34.845, fleet_mode: 'leeva', onboarding_completed: true })
    .select('id')
    .single();
  cleanup.push(() => db.from('restaurants').delete().eq('id', r.id));
  cleanup.push(() => db.from('orders').delete().eq('restaurant_id', r.id));
  cleanup.push(() => db.from('credit_ledger').delete().eq('restaurant_id', r.id));
  cleanup.push(() => db.from('restaurant_credits').delete().eq('restaurant_id', r.id));
  await addCredit(db, r.id, 200, 'purchase', '[HOLD] saldo');

  let heldId;

  await t('holdForReview → pedido segurado, sem despacho, sem crédito', async () => {
    const before = (await getCreditBalance(db, r.id)).balance;
    const c = await createOrderFromNormalized(db, r.id, normalized(1), { holdForReview: true });
    assert.equal(c.ok, true);
    heldId = c.orderId;
    const { data: o } = await db
      .from('orders')
      .select('dispatch_hold, dispatch_state, driver_payout, leeva_fee')
      .eq('id', heldId)
      .single();
    assert.equal(o.dispatch_hold, true);
    assert.equal(o.dispatch_state, 'none');
    assert.equal(o.driver_payout, null, 'taxa não calculada ainda');
    assert.equal((await getCreditBalance(db, r.id)).balance, before, 'crédito intacto');
  });

  await t('callDriverForOrder → calcula taxa, desconta crédito, libera despacho', async () => {
    const before = (await getCreditBalance(db, r.id)).balance;
    const res = await callDriverForOrder(db, heldId, r.id);
    assert.equal(res.ok, true);
    assert.ok(res.cost > 0);
    const { data: o } = await db
      .from('orders')
      .select('dispatch_hold, dispatch_state, driver_payout')
      .eq('id', heldId)
      .single();
    assert.equal(o.dispatch_hold, false);
    assert.equal(o.dispatch_state, 'searching');
    assert.ok(o.driver_payout > 0);
    assert.ok((await getCreditBalance(db, r.id)).balance < before, 'crédito descontado');
  });

  await t('callDriverForOrder de novo → recusa (já enviado)', async () => {
    const res = await callDriverForOrder(db, heldId, r.id);
    assert.equal(res.ok, false);
    assert.equal(res.code, 'not_held');
  });

  await t('Recusar → fecha como entregue por fora, sem custo', async () => {
    const before = (await getCreditBalance(db, r.id)).balance;
    const c = await createOrderFromNormalized(db, r.id, normalized(3), { holdForReview: true });
    const res = await markOrderHandledExternally(db, c.orderId, r.id);
    assert.equal(res.ok, true);
    const { data: o } = await db
      .from('orders')
      .select('status, delivery_gps_status, dispatch_hold')
      .eq('id', c.orderId)
      .single();
    assert.equal(o.status, 'delivered');
    assert.equal(o.delivery_gps_status, 'external');
    assert.equal(o.dispatch_hold, false);
    assert.equal((await getCreditBalance(db, r.id)).balance, before, 'crédito intacto');
  });

  await t('iFood conclui um pedido segurado → fecha como externa no Leeva', async () => {
    const ext = `hold-con-${Date.now()}`;
    const c = await createOrderFromNormalized(
      db,
      r.id,
      { ...normalized(4), externalId: ext },
      { holdForReview: true },
    );
    const res = await closeIfoodOrder(db, r.id, ext, 'concluded');
    assert.equal(res.ok, true);
    assert.equal(res.action, 'delivered_external');
    const { data: o } = await db.from('orders').select('status, delivery_gps_status').eq('id', c.orderId).single();
    assert.equal(o.status, 'delivered');
    assert.equal(o.delivery_gps_status, 'external');
  });

  await t('iFood cancela um pedido segurado → cancela no Leeva', async () => {
    const ext = `hold-can-${Date.now()}`;
    const c = await createOrderFromNormalized(
      db,
      r.id,
      { ...normalized(5), externalId: ext },
      { holdForReview: true },
    );
    const res = await closeIfoodOrder(db, r.id, ext, 'cancelled');
    assert.equal(res.ok, true);
    const { data: o } = await db.from('orders').select('status').eq('id', c.orderId).single();
    assert.equal(o.status, 'cancelled');
  });

  await t('sem saldo → pedido continua segurado', async () => {
    // zera o saldo
    const bal = (await getCreditBalance(db, r.id)).balance;
    if (bal > 0) await adjustCredit(db, r.id, -bal, '[HOLD] zera');
    const c = await createOrderFromNormalized(db, r.id, normalized(2), { holdForReview: true });
    const res = await callDriverForOrder(db, c.orderId, r.id);
    assert.equal(res.ok, false);
    assert.equal(res.code, 'insufficient_credit');
    const { data: o } = await db.from('orders').select('dispatch_hold').eq('id', c.orderId).single();
    assert.equal(o.dispatch_hold, true, 'continua segurado');
  });
};

run()
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
