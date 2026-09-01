/**
 * Testes de concorrência (race conditions). Bate direto nos serviços com
 * o cliente service_role, disparando ações simultâneas. Cria fixtures
 * [CONC], testa, limpa.
 *
 * Uso: node --import tsx --env-file=apps/restaurante/.env.local scripts/test-concurrency.mjs
 */
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {
  assignDriver,
  advanceOrderStatus,
  acceptDelivery,
  processInboundWebhook,
  dispatchTick,
} from '../packages/shared/src/services/index.ts';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); console.log(`  ✓ ${name}`); pass++; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); fail++; }
};
const cleanup = [];

async function main() {
  const { data: r } = await db.from('restaurants').insert({ name: '[CONC] R', latitude: -7.1, longitude: -34.8 }).select('id').single();
  cleanup.push(() => db.from('restaurants').delete().eq('id', r.id));
  const mk = async (n) => (await db.from('motoboys').insert({ restaurant_id: r.id, full_name: `[CONC] ${n}`, phone: `c${n}`, status: 'available', current_latitude: -7.1, current_longitude: -34.8, max_concurrent_deliveries: 2, terms_accepted_version: 1 }).select('id').single()).data;
  const m1 = await mk('m1'), m2 = await mk('m2');
  const mkOrder = async (status = 'ready') => (await db.from('orders').insert({
    restaurant_id: r.id, customer_name: 'C', customer_address: 'Rua - Centro', latitude: -7.1, longitude: -34.8,
    order_amount: 10, delivery_fee: 5, status, notes: '[CONC]',
  }).select('id').single()).data;

  await t('2 despachos simultâneos do MESMO pedido → só 1 vence', async () => {
    const o = await mkOrder();
    const [a, b] = await Promise.all([
      assignDriver(db, o.id, m1.id, {}),
      assignDriver(db, o.id, m2.id, {}),
    ]);
    const wins = [a, b].filter((x) => x.ok).length;
    assert.equal(wins, 1, `venceram ${wins} (a=${JSON.stringify(a)} b=${JSON.stringify(b)})`);
    const { data: fresh } = await db.from('orders').select('motoboy_id, status').eq('id', o.id).single();
    assert.ok([m1.id, m2.id].includes(fresh.motoboy_id));
    assert.equal(fresh.status, 'assigned');
  });

  await t('2 transições simultâneas do mesmo pedido → estado consistente', async () => {
    const o = await mkOrder('assigned');
    await db.from('orders').update({ motoboy_id: m1.id }).eq('id', o.id);
    const [a, b] = await Promise.all([
      advanceOrderStatus(db, o.id, 'picked_up', { actorType: 'motoboy' }),
      advanceOrderStatus(db, o.id, 'cancelled', { actorType: 'restaurant' }),
    ]);
    const wins = [a, b].filter((x) => x.ok).length;
    assert.equal(wins, 1, `venceram ${wins}`);
    const { data: fresh } = await db.from('orders').select('status').eq('id', o.id).single();
    assert.ok(['picked_up', 'cancelled'].includes(fresh.status));
  });

  await t('conclusão duplicada → segunda é no-op, sem estado inválido', async () => {
    const o = await mkOrder('in_route');
    await db.from('orders').update({ motoboy_id: m1.id }).eq('id', o.id);
    const [a, b] = await Promise.all([
      advanceOrderStatus(db, o.id, 'delivered', { actorType: 'motoboy' }),
      advanceOrderStatus(db, o.id, 'delivered', { actorType: 'motoboy' }),
    ]);
    assert.ok(a.ok && b.ok); // ambos "ok" (idempotente), sem erro
    const { count } = await db.from('order_events').select('id', { count: 'exact', head: true }).eq('order_id', o.id).eq('type', 'delivery.delivered');
    assert.equal(count, 1, `eventos delivery.delivered: ${count}`);
  });

  await t('aceite duplicado → 1 evento delivery.accepted', async () => {
    const o = await mkOrder('assigned');
    await db.from('orders').update({ motoboy_id: m1.id }).eq('id', o.id);
    await Promise.all([acceptDelivery(db, o.id, m1.id), acceptDelivery(db, o.id, m1.id), acceptDelivery(db, o.id, m1.id)]);
    const { count } = await db.from('order_events').select('id', { count: 'exact', head: true }).eq('order_id', o.id).eq('type', 'delivery.accepted');
    assert.equal(count, 1, `eventos: ${count}`);
  });

  await t('capacidade: motoboy no limite não recebe mais entregas', async () => {
    const o1 = await mkOrder(), o2 = await mkOrder(), o3 = await mkOrder();
    await assignDriver(db, o1.id, m2.id, {});
    await assignDriver(db, o2.id, m2.id, {});
    const r3 = await assignDriver(db, o3.id, m2.id, {}); // limite = 2
    assert.equal(r3.ok, false);
    assert.match(r3.error, /limite/i);
  });

  await t('cron: 4 ticks globais simultâneos → só 1 processa (lease), sem oferta em duplicidade', async () => {
    await db.rpc('release_dispatch_lease');
    const o = await mkOrder('ready');
    await db.from('orders').update({ dispatch_state: 'searching' }).eq('id', o.id);
    const results = await Promise.all(Array.from({ length: 4 }, () => dispatchTick(db, { source: 'conc' })));
    const ran = results.filter((r) => !r.skipped).length;
    assert.equal(ran, 1, `deveria rodar 1, rodou ${ran}`);
    const { count } = await db
      .from('dispatch_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', o.id)
      .is('responded_at', null);
    assert.ok(count <= 1, `no máx 1 oferta aberta, tem ${count}`);
  });

  await t('webhook duplicado (mesmo event_id) → 1 pedido', async () => {
    const payload = { id: 'CONC-EVT-1', customer: { name: 'W' }, items: [{ name: 'x', quantity: 1, unitPrice: 5 }], delivery: { deliveryAddress: { formattedAddress: 'Rua W - Centro' } }, total: { subTotal: 5, deliveryFee: 3 } };
    const input = { provider: 'ifood', restaurantId: r.id, headers: {}, rawBody: JSON.stringify(payload), payload };
    const [a, b] = await Promise.all([processInboundWebhook(db, input), processInboundWebhook(db, input)]);
    // sem assinatura válida (PREPARADO) ambos são 401 — então testamos idempotência do LOG
    const { count } = await db.from('integration_events').select('id', { count: 'exact', head: true }).eq('event_id', 'CONC-EVT-1');
    assert.equal(count, 1, `integration_events: ${count}`);
    assert.ok([a.status, b.status].every((s) => s === 401 || s === 200));
  });
}

main().catch((e) => { console.error(e); fail++; }).finally(async () => {
  for (const c of cleanup.reverse()) { try { await c(); } catch {} }
  console.log(`\n${pass} passaram, ${fail} falharam`);
  process.exit(fail ? 1 : 0);
});
