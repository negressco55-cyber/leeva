import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimizeStopOrder, evaluateRoute, googleMapsRouteUrl } from '../services/route-optimizer';
import { computeCustomerDeliveryFee } from '../services/payout';

// João Pessoa, mais ou menos: restaurante em Manaíra, paradas em linha pro sul
const origin = { latitude: -7.1, longitude: -34.83 };
const near = { latitude: -7.11, longitude: -34.83 }; // ~1,1 km
const mid = { latitude: -7.13, longitude: -34.83 }; // ~3,3 km
const far = { latitude: -7.16, longitude: -34.83 }; // ~6,7 km
const T0 = Date.UTC(2026, 9, 5, 22, 0);
const min = (m: number) => T0 + m * 60_000;

test('sem prazo: vai na ordem que roda menos (perto → meio → longe)', () => {
  const r = optimizeStopOrder(
    origin,
    [
      { id: 'far', point: far, deadline: null },
      { id: 'near', point: near, deadline: null },
      { id: 'mid', point: mid, deadline: null },
    ],
    { startAt: T0 },
  );
  assert.deepEqual(r.order, ['near', 'mid', 'far']);
  assert.equal(r.lateMinutes, 0);
});

test('prazo estourando muda a ordem: o pedido longe e atrasado vai primeiro', () => {
  // perto pro norte, longe pro sul: ir no perto antes faz o longe estourar
  const north = { latitude: -7.09, longitude: -34.83 };
  const stops = [
    { id: 'near', point: north, deadline: min(60) },
    { id: 'far', point: far, deadline: min(28) },
  ];
  const r = optimizeStopOrder(origin, stops, { startAt: T0 });
  assert.equal(r.order[0], 'far');
  // a ordem "mais curta" atrasaria o pedido longe
  const naive = evaluateRoute(origin, [stops[0]!, stops[1]!], { startAt: T0 });
  assert.ok(naive.lateMinutes > r.lateMinutes);
});

test('muitas paradas (acima do exato) devolve todas, sem repetir', () => {
  const stops = Array.from({ length: 9 }, (_, i) => ({
    id: `p${i}`,
    point: { latitude: -7.1 - i * 0.004, longitude: -34.83 + (i % 2) * 0.004 },
    deadline: min(40 + i),
  }));
  const r = optimizeStopOrder(origin, stops, { startAt: T0 });
  assert.equal(r.order.length, 9);
  assert.equal(new Set(r.order).size, 9);
});

test('link do Google Maps leva todas as paradas na ordem', () => {
  const url = googleMapsRouteUrl([near, mid, far])!;
  assert.ok(url.startsWith('https://www.google.com/maps/dir/?'));
  const p = new URL(url).searchParams;
  assert.equal(p.get('destination'), '-7.16,-34.83');
  assert.equal(p.get('waypoints'), '-7.11,-34.83|-7.13,-34.83');
});

test('taxa do cliente: fixa até X km, + por km a mais, grátis acima do pedido mínimo', () => {
  const cfg = { customer_fee: 6, customer_fee_included_km: 3, customer_fee_per_extra_km: 1.5, free_delivery_min_order: 80 };
  assert.equal(computeCustomerDeliveryFee(cfg, 2, 40), 6);
  assert.equal(computeCustomerDeliveryFee(cfg, 5, 40), 9); // 6 + 2 km × 1,50
  assert.equal(computeCustomerDeliveryFee(cfg, 5, 100), 0);
  assert.equal(computeCustomerDeliveryFee({ ...cfg, customer_fee_per_extra_km: 0 }, 10, 40), 6); // fixa
});

test('taxa por bairro: vence a regra por km, ignora acento/caixa e acha no endereço', () => {
  const cfg = {
    customer_fee: 6,
    customer_fee_included_km: 3,
    customer_fee_per_extra_km: 1.5,
    free_delivery_min_order: 80,
    customer_fee_by_region: [
      { region: 'Jardim Oceania', fee: 15 },
      { region: 'Bessa', fee: 12 },
      { region: 'Cidade Universitária', fee: 10 },
      { region: 'Jardim Cidade Universitária', fee: 11 },
    ],
  };
  assert.equal(computeCustomerDeliveryFee(cfg, 8, 40, { region: 'JD. OCEÂNIA' }), 15);
  assert.equal(computeCustomerDeliveryFee(cfg, 8, 40, { region: null, address: 'Rua X, 10, Bessa, João Pessoa - PB' }), 12);
  assert.equal(computeCustomerDeliveryFee(cfg, 8, 40, { address: 'Av. Y, 5 - Jardim Cidade Universitária' }), 11);
  assert.equal(computeCustomerDeliveryFee(cfg, 5, 40, { region: 'Manaíra' }), 9); // não cadastrado → km
  assert.equal(computeCustomerDeliveryFee(cfg, 5, 100, { region: 'Bessa' }), 0); // frete grátis vence
});
