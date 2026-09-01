/**
 * Testes da Fase 5 Bloco C — agrupamento de entregas com precificação
 * incremental. Fixtures [F5C], limpa no fim.
 *
 * Uso: node --import tsx --env-file=apps/restaurante/.env.local scripts/test-fase5c.mjs
 */
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {
  createOrderFromNormalized,
  ensureSubscription,
  changePlan,
  addCredit,
  getCreditBalance,
  runDispatchTick,
  acceptOffer,
  declineOffer,
  planGroupForOrder,
  getPayoutPolicy,
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
const round = (n) => Math.round(n * 100) / 100;

// restaurante em -7.115,-34.845 ; destinos próximos entre si na Bessa
const REST = { latitude: -7.115, longitude: -34.845 };
const DESTS = {
  a: { latitude: -7.105, longitude: -34.84 }, // ~1.3 km do restaurante
  b: { latitude: -7.1045, longitude: -34.8395 }, // ~70 m de A
  c: { latitude: -7.104, longitude: -34.839 }, // ~140 m de A
  far: { latitude: -7.14, longitude: -34.88 }, // longe
};

async function main() {
  const { data: r } = await db
    .from('restaurants')
    .insert({ name: '[F5C] R', latitude: REST.latitude, longitude: REST.longitude, fleet_mode: 'leeva', onboarding_completed: true })
    .select('id')
    .single();
  cleanup.push(() => db.from('restaurants').delete().eq('id', r.id));
  cleanup.push(() => db.from('credit_ledger').delete().eq('restaurant_id', r.id));
  cleanup.push(() => db.from('restaurant_credits').delete().eq('restaurant_id', r.id));

  await ensureSubscription(db, r.id, 'pro');
  await changePlan(db, r.id, 'pro'); // margem 1,00
  await addCredit(db, r.id, 500, 'purchase', '[F5C] saldo');

  const mkDriver = async (extra = {}) => {
    const { data } = await db
      .from('motoboys')
      .insert({
        restaurant_id: null,
        fleet: 'leeva',
        full_name: '[F5C] D',
        phone: `f5c${Math.random()}`.slice(0, 15),
        status: 'available',
        current_latitude: REST.latitude,
        current_longitude: REST.longitude,
        location_updated_at: new Date().toISOString(),
        rating: 4.9,
        deliveries_total: 30,
        deliveries_completed: 29,
        deliveries_late: 0,
        approval_status: 'approved',
        terms_accepted_version: 1,
        max_concurrent_deliveries: 5,
        ...extra,
      })
      .select('id')
      .single();
    cleanup.push(() => db.from('motoboys').delete().eq('id', data.id));
    return data.id;
  };

  const mkOrder = async (dest, tag) => {
    const res = await createOrderFromNormalized(db, r.id, {
      externalId: null,
      source: 'manual',
      customer: { name: `C ${tag}`, phone: null },
      items: [],
      address: { formatted: `Rua ${tag} - Bessa`, latitude: dest.latitude, longitude: dest.longitude, region: 'Bessa' },
      total: 0,
      deliveryFee: 0,
      paymentMethod: 'online',
      paymentStatus: 'paid',
    });
    assert.ok(res.ok, res.error);
    cleanup.push(() => db.from('orders').delete().eq('id', res.orderId));
    // pronto para despacho
    await db.from('orders').update({ status: 'ready', dispatch_state: 'searching' }).eq('id', res.orderId);
    return res.orderId;
  };

  const clearSearching = async () => {
    // evita interferência entre testes: zera ofertas abertas e volta status
    await db.from('dispatch_attempts').delete().eq('restaurant_id', r.id).is('responded_at', null);
  };

  let policy;
  await t('setup: policy tem chaves de agrupamento', async () => {
    policy = await getPayoutPolicy(db, r.id);
    assert.ok(policy.group_stop_min >= 0);
    assert.ok(policy.group_max_stops >= 2);
  });

  // -----------------------------------------------------------------
  await t('planGroupForOrder: 2 destinos próximos → rota de 2 paradas', async () => {
    const oa = await mkOrder(DESTS.a, 'A');
    const ob = await mkOrder(DESTS.b, 'B');
    const plan = await planGroupForOrder(db, oa);
    assert.ok(plan, 'deveria montar um grupo');
    assert.equal(plan.stops.length, 2);
    assert.equal(plan.stops[0].seq, 1);
    // parada 1 = tabela cheia (>= mínimo)
    assert.ok(plan.stops[0].payout >= policy.min_payout - 0.001);
    // parada 2 = piso ou km incremental × per_km
    const inc = plan.stops[1].legKm * policy.per_km;
    assert.equal(plan.stops[1].payout, round(Math.max(policy.group_stop_min, inc)));
    // total do motoboy = soma
    assert.equal(plan.totalPayout, round(plan.stops[0].payout + plan.stops[1].payout));
    // cobrança por pedido = payout + margem
    assert.equal(plan.stops[1].total, round(plan.stops[1].payout + plan.margin));
    await db.from('orders').delete().in('id', [oa, ob]);
  });

  await t('planGroupForOrder: destino longe NÃO entra no grupo', async () => {
    const oa = await mkOrder(DESTS.a, 'A');
    const ofar = await mkOrder(DESTS.far, 'FAR');
    const plan = await planGroupForOrder(db, oa);
    assert.equal(plan, null, 'não deveria agrupar destino distante');
    await db.from('orders').delete().in('id', [oa, ofar]);
  });

  await t('despacho: 3 destinos próximos → 1 oferta agrupada de 3 paradas', async () => {
    await clearSearching();
    const d = await mkDriver();
    const oa = await mkOrder(DESTS.a, 'A');
    const ob = await mkOrder(DESTS.b, 'B');
    const oc = await mkOrder(DESTS.c, 'C');

    await runDispatchTick(db, r.id);

    const { data: offers } = await db
      .from('dispatch_attempts')
      .select('id, motoboy_id, order_id, group_order_ids, group_plan, payout_estimate')
      .eq('restaurant_id', r.id)
      .is('responded_at', null);
    assert.equal(offers.length, 1, `esperava 1 oferta, veio ${offers.length}`);
    const off = offers[0];
    assert.equal(off.group_order_ids.length, 3);
    assert.equal(off.group_plan.length, 3);
    const sum = round(off.group_plan.reduce((s, x) => s + Number(x.payout), 0));
    assert.equal(Number(off.payout_estimate), sum);

    // aceitar → os 3 pedidos ficam com o motoboy
    const res = await acceptOffer(db, off.id, off.motoboy_id);
    assert.ok(res.ok, res.error);
    const { data: assigned } = await db
      .from('orders')
      .select('id, motoboy_id, status, driver_payout, group_id, group_sequence')
      .in('id', [oa, ob, oc]);
    assert.ok(assigned.every((x) => x.motoboy_id === d), 'todos com o mesmo motoboy');
    assert.ok(assigned.every((x) => x.status === 'assigned'));
    assert.ok(assigned.every((x) => x.group_id));
    // cada driver_payout bate com o plano
    for (const stop of off.group_plan) {
      const o = assigned.find((x) => x.id === stop.orderId);
      assert.equal(Number(o.driver_payout), round(Number(stop.payout)));
    }
    await db.from('orders').delete().in('id', [oa, ob, oc]);
  });

  await t('recusar oferta agrupada → grupo dissolvido, cada pedido volta individual', async () => {
    await clearSearching();
    const d = await mkDriver();
    const oa = await mkOrder(DESTS.a, 'A');
    const ob = await mkOrder(DESTS.b, 'B');
    await runDispatchTick(db, r.id);
    const { data: offers } = await db
      .from('dispatch_attempts')
      .select('id, motoboy_id, group_order_ids')
      .eq('restaurant_id', r.id)
      .is('responded_at', null);
    assert.equal(offers.length, 1);
    assert.ok(offers[0].group_order_ids.length >= 2);

    const res = await declineOffer(db, offers[0].id, offers[0].motoboy_id, 'não quero');
    assert.ok(res.ok, res.error);

    const { data: after } = await db
      .from('orders')
      .select('id, group_id, group_sequence, group_lead, driver_payout, dispatch_state')
      .in('id', [oa, ob]);
    assert.ok(after.every((x) => x.group_id === null), 'group_id limpo');
    assert.ok(after.every((x) => x.group_lead === false));
    assert.ok(after.every((x) => x.driver_payout != null), 'cobrança individual recomposta');
    assert.ok(after.every((x) => x.dispatch_state === 'searching'));
    await db.from('orders').delete().in('id', [oa, ob]);
  });

  await t('crédito: agrupar devolve a diferença ao restaurante', async () => {
    await clearSearching();
    const d = await mkDriver();
    await addCredit(db, r.id, 1000, 'purchase', '[F5C] top-up');
    const before = (await getCreditBalance(db, r.id)).balance;
    const oa = await mkOrder(DESTS.a, 'A');
    const ob = await mkOrder(DESTS.b, 'B');
    const afterCreate = (await getCreditBalance(db, r.id)).balance;
    // 2 pedidos debitaram valor cheio
    assert.ok(afterCreate < before, `criação deveria debitar (${before} → ${afterCreate})`);

    await runDispatchTick(db, r.id);
    const afterGroup = (await getCreditBalance(db, r.id)).balance;
    // agrupar reduz a cobrança do 2º pedido → parte do crédito volta
    assert.ok(afterGroup > afterCreate, `agrupamento deveria devolver crédito (${afterCreate} → ${afterGroup})`);

    const { data: ledger } = await db
      .from('credit_ledger')
      .select('kind, amount, description')
      .eq('restaurant_id', r.id)
      .eq('kind', 'adjustment');
    assert.ok(ledger.length >= 1, 'deveria ter lançamento de ajuste');
    await db.from('orders').delete().in('id', [oa, ob]);
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
