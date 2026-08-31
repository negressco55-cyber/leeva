/**
 * Testes da Fase 4 — camada financeira. Fixtures [F4], limpa no fim.
 *
 * Uso: node --import tsx --env-file=apps/restaurante/.env.local scripts/test-fase4.mjs
 *
 * BLOCO 0 (bug): o valor da oferta (payout_estimate) e o valor final gravado
 * na entrega (orders.driver_payout) DEVEM ser idênticos, sempre.
 */
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {
  runDispatchTick,
  acceptOffer,
  assignDriver,
  advanceOrderStatus,
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
    .insert({ name: '[F4] R', latitude: -7.115, longitude: -34.845, fleet_mode: 'leeva', onboarding_completed: true })
    .select('id')
    .single();
  cleanup.push(() => db.from('restaurants').delete().eq('id', r.id));

  const mkDriver = async (extra = {}) => {
    const { data } = await db
      .from('motoboys')
      .insert({
        restaurant_id: null,
        fleet: 'leeva',
        full_name: '[F4] D',
        phone: `f4${Math.random()}`.slice(0, 15),
        status: 'available',
        current_latitude: -7.114,
        current_longitude: -34.844,
        location_updated_at: new Date().toISOString(),
        rating: 4.8,
        deliveries_total: 20,
        deliveries_completed: 19,
        deliveries_late: 1,
        ...extra,
      })
      .select('id')
      .single();
    cleanup.push(() => db.from('motoboys').delete().eq('id', data.id));
    return data.id;
  };

  const mkOrder = async (extra = {}) => {
    const { data } = await db
      .from('orders')
      .insert({
        restaurant_id: r.id,
        customer_name: 'C',
        customer_address: 'Rua X - Bessa',
        latitude: -7.108,
        longitude: -34.836,
        order_amount: 40,
        delivery_fee: 0, // SEM taxa manual — o cenário do bug
        status: 'ready',
        dispatch_state: 'searching',
        notes: '[F4]',
        ...extra,
      })
      .select('id, order_number')
      .single();
    cleanup.push(() => db.from('orders').delete().eq('id', data.id));
    return data;
  };

  // ---------------------------------------------------------------
  // BLOCO 0 — regressão do bug "oferta R$7,50 vs registrado R$7,00"
  // ---------------------------------------------------------------
  await t('oferta aceita: payout_estimate == orders.driver_payout (fonte única)', async () => {
    const dId = await mkDriver();
    const o = await mkOrder();
    await runDispatchTick(db, r.id);

    const { data: offer } = await db
      .from('dispatch_attempts')
      .select('id, motoboy_id, payout_estimate')
      .eq('order_id', o.id)
      .is('responded_at', null)
      .maybeSingle();
    assert.ok(offer, 'nenhuma oferta criada');
    assert.ok(offer.payout_estimate != null, 'oferta sem payout_estimate');

    const res = await acceptOffer(db, offer.id, offer.motoboy_id);
    assert.ok(res.ok, res.error);

    const { data: ord } = await db.from('orders').select('driver_payout').eq('id', o.id).single();
    assert.equal(
      Number(ord.driver_payout),
      Number(offer.payout_estimate),
      `oferta mostrou ${offer.payout_estimate}, gravou ${ord.driver_payout}`,
    );
  });

  await t('valor não muda ao concluir a entrega', async () => {
    const dId = await mkDriver();
    const o = await mkOrder();
    await runDispatchTick(db, r.id);
    const { data: offer } = await db
      .from('dispatch_attempts')
      .select('id, motoboy_id, payout_estimate')
      .eq('order_id', o.id)
      .is('responded_at', null)
      .maybeSingle();
    await acceptOffer(db, offer.id, offer.motoboy_id);
    const { data: afterAccept } = await db.from('orders').select('driver_payout').eq('id', o.id).single();

    await advanceOrderStatus(db, o.id, 'picked_up', { actorType: 'motoboy' });
    await advanceOrderStatus(db, o.id, 'in_route', { actorType: 'motoboy' });
    await advanceOrderStatus(db, o.id, 'delivered', { actorType: 'motoboy' });

    const { data: afterDeliver } = await db.from('orders').select('driver_payout').eq('id', o.id).single();
    assert.equal(Number(afterDeliver.driver_payout), Number(afterAccept.driver_payout));
    assert.equal(Number(afterDeliver.driver_payout), Number(offer.payout_estimate));
  });

  await t('atribuição manual (sem oferta): driver_payout é calculado e gravado', async () => {
    const dId = await mkDriver();
    const o = await mkOrder({ dispatch_state: 'none' });
    const res = await assignDriver(db, o.id, dId, {});
    assert.ok(res.ok, res.error);
    const { data: ord } = await db.from('orders').select('driver_payout').eq('id', o.id).single();
    assert.ok(ord.driver_payout != null, 'driver_payout não gravado na atribuição manual');
    assert.ok(Number(ord.driver_payout) > 0);
  });

  await t('o valor pago ao motoboy nunca é uma fração da venda (order_amount)', async () => {
    const dId = await mkDriver();
    const o = await mkOrder({ order_amount: 120 });
    await runDispatchTick(db, r.id);
    const { data: offer } = await db
      .from('dispatch_attempts')
      .select('id, motoboy_id, payout_estimate')
      .eq('order_id', o.id)
      .is('responded_at', null)
      .maybeSingle();
    await acceptOffer(db, offer.id, offer.motoboy_id);
    const { data: ord } = await db.from('orders').select('driver_payout').eq('id', o.id).single();
    // o payout é da tabela de distância, não % da venda
    assert.notEqual(Number(ord.driver_payout), 120);
    assert.ok(Number(ord.driver_payout) < 60, 'payout parece proporcional à venda — errado');
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
