import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDriverPayout,
  computeGroupedStopPayout,
  computeLogisticsFinance,
  DEFAULT_PAYOUT_CONFIG,
} from '../services/payout';

// ---- entrega solta: max(distanciaKm × per_km, min_payout) ----

test('entrega solta: 2 km → R$ 5,00 (mínimo, pois 2×2=4 < 5)', () => {
  const r = computeDriverPayout(DEFAULT_PAYOUT_CONFIG, { distanceKm: 2 });
  assert.equal(r.total, 5);
});

test('entrega solta: 3 km → R$ 6,00', () => {
  const r = computeDriverPayout(DEFAULT_PAYOUT_CONFIG, { distanceKm: 3 });
  assert.equal(r.total, 6);
});

test('entrega solta: 4 km → R$ 8,00', () => {
  const r = computeDriverPayout(DEFAULT_PAYOUT_CONFIG, { distanceKm: 4 });
  assert.equal(r.total, 8);
});

test('entrega solta: 5 km → R$ 10,00', () => {
  const r = computeDriverPayout(DEFAULT_PAYOUT_CONFIG, { distanceKm: 5 });
  assert.equal(r.total, 10);
});

test('entrega solta: distância contínua, não em degraus (3,4 km ≠ 3 km)', () => {
  const a = computeDriverPayout(DEFAULT_PAYOUT_CONFIG, { distanceKm: 3 }).total;
  const b = computeDriverPayout(DEFAULT_PAYOUT_CONFIG, { distanceKm: 3.4 }).total;
  assert.equal(a, 6);
  assert.equal(b, 6.8); // 3,4 × 2,00
  assert.notEqual(a, b);
});

test('entrega solta: valor custom de per_km/min_payout', () => {
  const cfg = { ...DEFAULT_PAYOUT_CONFIG, per_km: 3, min_payout: 10 };
  assert.equal(computeDriverPayout(cfg, { distanceKm: 2 }).total, 10); // 2×3=6 < 10
  assert.equal(computeDriverPayout(cfg, { distanceKm: 5 }).total, 15); // 5×3=15 ≥ 10
});

test('entrega solta: bônus de pico soma por cima do valor por km/mínimo', () => {
  const cfg = { ...DEFAULT_PAYOUT_CONFIG, peak_bonus: 2, peak_hours: [[18, 21]] as [number, number][] };
  const peak = computeDriverPayout(cfg, { distanceKm: 5, at: new Date('2026-01-01T19:00:00') });
  const off = computeDriverPayout(cfg, { distanceKm: 5, at: new Date('2026-01-01T14:00:00') });
  assert.equal(peak.total, 12); // 10 + 2
  assert.equal(off.total, 10);
});

test('entrega solta: distância zero/nula cai no mínimo', () => {
  assert.equal(computeDriverPayout(DEFAULT_PAYOUT_CONFIG, { distanceKm: 0 }).total, 5);
  assert.equal(computeDriverPayout(DEFAULT_PAYOUT_CONFIG, { distanceKm: null }).total, 5);
});

// ---- parada extra de rota agrupada: max(legKm × per_km_grouped, min_payout) ----

test('parada extra: trecho de 2 km → R$ 5,00 (mínimo, pois 2×2,5=5 = mínimo)', () => {
  assert.equal(computeGroupedStopPayout(DEFAULT_PAYOUT_CONFIG, 2), 5);
});

test('parada extra: trecho de 3 km → R$ 7,50 (3×2,50)', () => {
  assert.equal(computeGroupedStopPayout(DEFAULT_PAYOUT_CONFIG, 3), 7.5);
});

test('parada extra: trecho de 1 km → R$ 5,00 (mínimo, pois 1×2,5=2,5 < 5)', () => {
  assert.equal(computeGroupedStopPayout(DEFAULT_PAYOUT_CONFIG, 1), 5);
});

// ---- exemplo de conferência do enunciado: rota com 2 paradas ----

test('exemplo do enunciado: rota 4 km (líder) + 2 km incremental (extra) → total R$ 13,00', () => {
  const lead = computeDriverPayout(DEFAULT_PAYOUT_CONFIG, { distanceKm: 4 }).total;
  const extra = computeGroupedStopPayout(DEFAULT_PAYOUT_CONFIG, 2);
  assert.equal(lead, 8); // 4 × 2,00
  assert.equal(extra, 5); // 2 × 2,50 = 5,00, empata com o mínimo
  assert.equal(round(lead + extra), 13);
});

// ---- margem logística (inalterado pela mudança de tarifa) ----

test('margem logística = taxa cobrada − remuneração', () => {
  const f = computeLogisticsFinance({ customerFee: 9.5, driverPayout: 8 });
  assert.equal(f.leevaFee, 9.5);
  assert.equal(f.driverPayout, 8);
  assert.equal(f.margin, 1.5);
});

test('margem: valores negativos são zerados', () => {
  const f = computeLogisticsFinance({ customerFee: -5, driverPayout: -2 });
  assert.equal(f.leevaFee, 0);
  assert.equal(f.driverPayout, 0);
  assert.equal(f.margin, 0);
});

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
