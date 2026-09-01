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
  createOrderFromNormalized,
  computeDeliveryCharge,
  ensureSubscription,
  changePlan,
  addCredit,
  getCreditBalance,
  consumeCreditForOrder,
  refundCreditForOrder,
  setPixKey,
  getPendingEarnings,
  closePayoutBatches,
  retryPayoutBatch,
  getPayoutHistory,
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

  // ---------------------------------------------------------------
  // BLOCO 1 — taxa automática, calculada na criação e gravada
  // ---------------------------------------------------------------
  await t('criação do pedido: driver_payout e total são calculados e gravados', async () => {
    await ensureSubscription(db, r.id, 'pro');
    const cp = await changePlan(db, r.id, 'pro'); // margem 1,00 — garante
    assert.ok(cp.ok, cp.error);
    const res = await createOrderFromNormalized(db, r.id, {
      externalId: null,
      source: 'manual',
      customer: { name: 'C', phone: null },
      items: [],
      address: { formatted: 'Rua Y - Bessa', latitude: -7.093, longitude: -34.84, region: 'Bessa' },
      total: 0,
      deliveryFee: 0,
      paymentMethod: 'online',
      paymentStatus: 'paid',
      notes: '[F4]',
    }, { skipCredit: true });
    assert.ok(res.ok, res.error);
    cleanup.push(() => db.from('orders').delete().eq('id', res.orderId));
    const { data: o } = await db
      .from('orders')
      .select('driver_payout, customer_fee, leeva_fee, logistics_margin, route_distance_km, delivery_fee')
      .eq('id', res.orderId)
      .single();
    assert.ok(o.driver_payout != null && Number(o.driver_payout) >= 6, `payout ${o.driver_payout}`);
    assert.equal(Number(o.delivery_fee), 0, 'taxa manual deve ser 0');
    // total cobrado = payout + margem do plano (Pro = 1,00)
    assert.equal(Number(o.customer_fee), Number(o.leeva_fee));
    assert.equal(
      Math.round((Number(o.driver_payout) + 1.0) * 100) / 100,
      Number(o.customer_fee),
      `total ${o.customer_fee} != payout ${o.driver_payout} + 1,00`,
    );
    // margem (coluna gerada) = leeva_fee - driver_payout = 1,00
    assert.equal(Number(o.logistics_margin), 1.0);
  });

  await t('margem vem do plano do restaurante (Starter 1,50 vs Pro 1,00)', async () => {
    const mkAndCharge = async (planCode) => {
      await changePlan(db, r.id, planCode);
      const res = await createOrderFromNormalized(db, r.id, {
        externalId: null,
        source: 'manual',
        customer: { name: 'C', phone: null },
        items: [],
        address: { formatted: 'Rua Z - Bessa', latitude: -7.093, longitude: -34.84 },
        total: 0,
        deliveryFee: 0,
        paymentMethod: 'online',
        paymentStatus: 'paid',
        notes: '[F4]',
      }, { skipCredit: true });
      cleanup.push(() => db.from('orders').delete().eq('id', res.orderId));
      const { data: o } = await db.from('orders').select('logistics_margin').eq('id', res.orderId).single();
      return Number(o.logistics_margin);
    };
    assert.equal(await mkAndCharge('start'), 1.5);
    assert.equal(await mkAndCharge('pro'), 1.0);
    await changePlan(db, r.id, 'pro'); // volta
  });

  await t('preview (computeDeliveryCharge) = o que é gravado no pedido', async () => {
    const preview = await computeDeliveryCharge(db, r.id, { latitude: -7.093, longitude: -34.84 });
    const res = await createOrderFromNormalized(db, r.id, {
      externalId: null,
      source: 'manual',
      customer: { name: 'C', phone: null },
      items: [],
      address: { formatted: 'Rua W - Bessa', latitude: -7.093, longitude: -34.84 },
      total: 0,
      deliveryFee: 0,
      paymentMethod: 'online',
      paymentStatus: 'paid',
      notes: '[F4]',
    }, { skipCredit: true });
    cleanup.push(() => db.from('orders').delete().eq('id', res.orderId));
    const { data: o } = await db.from('orders').select('driver_payout, customer_fee').eq('id', res.orderId).single();
    assert.equal(Number(o.driver_payout), preview.driverPayout);
    assert.equal(Number(o.customer_fee), preview.total);
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

  // ---------------------------------------------------------------
  // BLOCO 2 — créditos pré-pagos
  // ---------------------------------------------------------------
  cleanup.push(() => db.from('credit_ledger').delete().eq('restaurant_id', r.id));
  cleanup.push(() => db.from('restaurant_credits').delete().eq('restaurant_id', r.id));

  const mkNormalized = (extra = {}) => ({
    externalId: null,
    source: 'manual',
    customer: { name: 'C', phone: null },
    items: [],
    address: { formatted: 'Rua C - Bessa', latitude: -7.093, longitude: -34.84 },
    total: 0,
    deliveryFee: 0,
    paymentMethod: 'online',
    paymentStatus: 'paid',
    notes: '[F4]',
    ...extra,
  });

  await t('crédito: compra soma ao saldo e registra no histórico', async () => {
    const bal = await addCredit(db, r.id, 100, 'purchase', 'teste');
    assert.equal(bal, 100);
    const { balance } = await getCreditBalance(db, r.id);
    assert.equal(balance, 100);
    const { count } = await db.from('credit_ledger').select('id', { count: 'exact', head: true }).eq('restaurant_id', r.id).eq('kind', 'purchase');
    assert.equal(count, 1);
  });

  await t('crédito: criar entrega debita o total do saldo', async () => {
    const before = (await getCreditBalance(db, r.id)).balance;
    const res = await createOrderFromNormalized(db, r.id, mkNormalized());
    assert.ok(res.ok, res.error);
    cleanup.push(() => db.from('orders').delete().eq('id', res.orderId));
    const { data: o } = await db.from('orders').select('customer_fee').eq('id', res.orderId).single();
    const after = (await getCreditBalance(db, r.id)).balance;
    assert.equal(Math.round((before - after) * 100) / 100, Number(o.customer_fee), 'débito != custo da entrega');
    const { data: led } = await db.from('credit_ledger').select('amount, kind').eq('order_id', res.orderId).single();
    assert.equal(led.kind, 'consumption');
    assert.equal(Number(led.amount), -Number(o.customer_fee));
  });

  await t('crédito: saldo insuficiente → pedido NÃO é criado', async () => {
    // zera o saldo
    const bal = (await getCreditBalance(db, r.id)).balance;
    if (bal > 0) await db.rpc('credit_consume', { p_restaurant_id: r.id, p_amount: bal, p_order_id: null, p_description: 'zera' });
    const res = await createOrderFromNormalized(db, r.id, mkNormalized());
    assert.equal(res.ok, false);
    assert.match(res.error, /insuficiente/i);
    // nenhum pedido órfão
    const { count } = await db.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', r.id).eq('customer_address', 'Rua C - Bessa').is('driver_payout', null);
    assert.equal(count, 0, 'ficou pedido órfão sem débito');
  });

  await t('crédito: cancelar entrega estorna o valor consumido', async () => {
    await addCredit(db, r.id, 50, 'purchase', 'recarrega');
    const res = await createOrderFromNormalized(db, r.id, mkNormalized());
    assert.ok(res.ok, res.error);
    cleanup.push(() => db.from('orders').delete().eq('id', res.orderId));
    const afterDebit = (await getCreditBalance(db, r.id)).balance;
    await advanceOrderStatus(db, res.orderId, 'cancelled', { actorType: 'restaurant' });
    const afterRefund = (await getCreditBalance(db, r.id)).balance;
    const { data: o } = await db.from('orders').select('customer_fee').eq('id', res.orderId).single();
    assert.equal(Math.round((afterRefund - afterDebit) * 100) / 100, Number(o.customer_fee), 'estorno != custo');
    // não estorna duas vezes
    const r2 = await refundCreditForOrder(db, res.orderId);
    assert.equal(r2, null);
  });

  await t('crédito: consume é idempotente (não debita duas vezes o mesmo pedido)', async () => {
    await addCredit(db, r.id, 100, 'purchase', 'x');
    const res = await createOrderFromNormalized(db, r.id, mkNormalized());
    cleanup.push(() => db.from('orders').delete().eq('id', res.orderId));
    const b1 = (await getCreditBalance(db, r.id)).balance;
    const { data: o } = await db.from('orders').select('customer_fee').eq('id', res.orderId).single();
    // tenta consumir de novo pelo mesmo pedido
    const again = await consumeCreditForOrder(db, r.id, Number(o.customer_fee), res.orderId, 'retry');
    assert.equal(again.ok, true);
    const b2 = (await getCreditBalance(db, r.id)).balance;
    assert.equal(b1, b2, 'debitou de novo');
  });

  await t('crédito: 2 entregas simultâneas quando só cabe 1 → só uma passa', async () => {
    // saldo suficiente para exatamente ~1 entrega
    const bal = (await getCreditBalance(db, r.id)).balance;
    if (bal > 0) await db.rpc('credit_consume', { p_restaurant_id: r.id, p_amount: bal, p_order_id: null, p_description: 'zera' });
    const preview = await computeDeliveryCharge(db, r.id, { latitude: -7.093, longitude: -34.84 });
    await addCredit(db, r.id, preview.total + 0.5, 'purchase', 'só 1');
    const [a, b] = await Promise.all([
      createOrderFromNormalized(db, r.id, mkNormalized()),
      createOrderFromNormalized(db, r.id, mkNormalized()),
    ]);
    for (const x of [a, b]) if (x.ok) cleanup.push(() => db.from('orders').delete().eq('id', x.orderId));
    const oks = [a, b].filter((x) => x.ok).length;
    assert.equal(oks, 1, `passaram ${oks}, deveria 1`);
    const final = (await getCreditBalance(db, r.id)).balance;
    assert.ok(final >= 0, `saldo ficou negativo: ${final}`);
  });

  // ---------------------------------------------------------------
  // BLOCO 4 — repasse ao motoboy
  // ---------------------------------------------------------------
  const earnMotoboys = [];
  let periodSeq = 0;
  const uniqPeriod = () => `2099-${String(1 + Math.floor(periodSeq / 28)).padStart(2, '0')}-${String(1 + (periodSeq++ % 28)).padStart(2, '0')}`;
  cleanup.push(() => db.from('payout_batches').delete().in('motoboy_id', earnMotoboys));

  const completeDelivery = async () => {
    // isola: só o novo motoboy fica disponível (evita a oferta ir p/ outro [F4] D)
    await db.from('motoboys').update({ status: 'offline' }).ilike('full_name', '[F4]%');
    const dId = await mkDriver();
    earnMotoboys.push(dId);
    const o = await mkOrder();
    await runDispatchTick(db, r.id);
    const { data: offer } = await db
      .from('dispatch_attempts')
      .select('id, motoboy_id')
      .eq('order_id', o.id)
      .is('responded_at', null)
      .maybeSingle();
    await acceptOffer(db, offer.id, offer.motoboy_id);
    await advanceOrderStatus(db, o.id, 'picked_up', { actorType: 'motoboy' });
    await advanceOrderStatus(db, o.id, 'in_route', { actorType: 'motoboy' });
    await advanceOrderStatus(db, o.id, 'delivered', { actorType: 'motoboy' });
    const { data: ord } = await db.from('orders').select('driver_payout').eq('id', o.id).single();
    return { motoboyId: offer.motoboy_id, payout: Number(ord.driver_payout) };
  };

  await t('repasse: entrega concluída gera driver_earnings (via trigger)', async () => {
    const { motoboyId, payout } = await completeDelivery();
    const { amount, count } = await getPendingEarnings(db, motoboyId);
    assert.equal(count, 1);
    assert.equal(amount, payout);
  });

  await t('repasse: chave Pix — validação', async () => {
    const dId = await mkDriver();
    earnMotoboys.push(dId);
    assert.equal((await setPixKey(db, dId, 'abc', 'email')).ok, false); // e-mail inválido
    assert.equal((await setPixKey(db, dId, 'x', 'cpf')).ok, false); // curta
    assert.equal((await setPixKey(db, dId, 'motoboy@teste.com', 'email')).ok, true);
    const { data: m } = await db.from('motoboys').select('pix_key, pix_key_type').eq('id', dId).single();
    assert.equal(m.pix_key, 'motoboy@teste.com');
    assert.equal(m.pix_key_type, 'email');
  });

  await t('repasse: fechamento paga (simulação) quando há chave Pix', async () => {
    const { motoboyId, payout } = await completeDelivery();
    await setPixKey(db, motoboyId, '11122233344', 'cpf');
    const period = uniqPeriod();
    const res = await closePayoutBatches(db, { periodDate: period });
    assert.ok(res.paid >= 1, `paid=${res.paid}`);
    const { data: batch } = await db
      .from('payout_batches')
      .select('status, amount, simulated, external_ref')
      .eq('motoboy_id', motoboyId)
      .eq('period_date', period)
      .single();
    assert.equal(batch.status, 'paid');
    assert.equal(batch.simulated, true);
    assert.equal(batch.external_ref, 'SIMULADO');
    assert.equal(Number(batch.amount), payout);
    // os ganhos ficaram ligados ao lote
    const { amount } = await getPendingEarnings(db, motoboyId);
    assert.equal(amount, 0, 'ainda tem ganho pendente após o fechamento');
  });

  await t('repasse: sem chave Pix → lote awaiting_pix + alerta, NÃO marca pago', async () => {
    const { motoboyId } = await completeDelivery(); // motoboy sem pix
    const period = uniqPeriod();
    await closePayoutBatches(db, { periodDate: period });
    const { data: batch } = await db
      .from('payout_batches')
      .select('id, status')
      .eq('motoboy_id', motoboyId)
      .eq('period_date', period)
      .single();
    assert.equal(batch.status, 'awaiting_pix');
    const { count } = await db
      .from('error_events')
      .select('id', { count: 'exact', head: true })
      .eq('scope', 'billing')
      .ilike('message', '%sem chave Pix%');
    assert.ok(count >= 1, 'nenhum alerta gerado');

    // motoboy cadastra a chave → reprocessa → paga
    await setPixKey(db, motoboyId, '99988877766', 'cpf');
    const retry = await retryPayoutBatch(db, batch.id);
    assert.ok(retry.ok, retry.error);
    const { data: after } = await db.from('payout_batches').select('status').eq('id', batch.id).single();
    assert.equal(after.status, 'paid');
  });

  await t('repasse: histórico do motoboy lista os lotes', async () => {
    const { motoboyId } = await completeDelivery();
    await setPixKey(db, motoboyId, '12312312312', 'cpf');
    await closePayoutBatches(db, { periodDate: uniqPeriod() });
    const h = await getPayoutHistory(db, motoboyId);
    assert.ok(h.length >= 1);
    assert.ok(['paid', 'pending', 'awaiting_pix'].includes(h[0].status));
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
