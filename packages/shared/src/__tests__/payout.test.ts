import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDriverPayout,
  computeLogisticsFinance,
  DEFAULT_PAYOUT_CONFIG,
} from '../services/payout';

test('payout: entrega simples = valor base (respeitando mínimo)', () => {
  const r = computeDriverPayout({ ...DEFAULT_PAYOUT_CONFIG, base: 7.5, min_payout: 7.5, per_km: 0 }, {
    distanceKm: 3,
  });
  assert.equal(r.total, 7.5);
});

test('payout: adicional por km acima do free_km', () => {
  const r = computeDriverPayout(
    { ...DEFAULT_PAYOUT_CONFIG, base: 6, per_km: 1, free_km: 2, min_payout: 0 },
    { distanceKm: 5 },
  );
  // 6 + (5-2)*1 = 9
  assert.equal(r.total, 9);
});

test('payout: entrega agrupada soma adicional por pedido extra', () => {
  const r = computeDriverPayout(
    { ...DEFAULT_PAYOUT_CONFIG, base: 7.5, grouped_extra: 3, per_km: 0, min_payout: 0 },
    { distanceKm: 2, groupSize: 3 },
  );
  // 7.5 + 2*3 = 13.5
  assert.equal(r.total, 13.5);
  assert.ok(r.breakdown.some((b) => /Agrupamento/.test(b.label)));
});

test('payout: bônus de pico só no horário configurado', () => {
  const cfg = { ...DEFAULT_PAYOUT_CONFIG, base: 7.5, peak_bonus: 2, peak_hours: [[18, 21]] as [number, number][], min_payout: 0, per_km: 0 };
  const peak = computeDriverPayout(cfg, { distanceKm: 1, at: new Date('2026-01-01T19:00:00') });
  const off = computeDriverPayout(cfg, { distanceKm: 1, at: new Date('2026-01-01T14:00:00') });
  assert.equal(peak.total, 9.5);
  assert.equal(off.total, 7.5);
});

test('payout: nunca abaixo do mínimo', () => {
  const r = computeDriverPayout({ ...DEFAULT_PAYOUT_CONFIG, base: 3, min_payout: 8, per_km: 0 }, { distanceKm: 1 });
  assert.equal(r.total, 8);
});

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

// ---- Fase 4: tabela de valores do entregador (base 5 / +1,50 km / mín 6) ----
const F4 = { ...DEFAULT_PAYOUT_CONFIG, base: 5, per_km: 1.5, free_km: 2, min_payout: 6, grouped_extra: 3, peak_bonus: 0 };

test('fase4: 2 km → mínimo R$ 6,00 (base 5 < mínimo 6)', () => {
  assert.equal(computeDriverPayout(F4, { distanceKm: 2 }).total, 6);
});

test('fase4: 3 km → R$ 6,50 (5 + 1×1,50)', () => {
  assert.equal(computeDriverPayout(F4, { distanceKm: 3 }).total, 6.5);
});

test('fase4: 2,67 km ainda cai no mínimo (5 + 0,67×1,50 ≈ 6,00)', () => {
  assert.equal(computeDriverPayout(F4, { distanceKm: 2.67 }).total, 6);
});

test('fase4: 5 km → R$ 9,50 (5 + 3×1,50)', () => {
  assert.equal(computeDriverPayout(F4, { distanceKm: 5 }).total, 9.5);
});

test('fase4: km adicional é contínuo, não em degraus (3,4 km ≠ 3 km)', () => {
  const a = computeDriverPayout(F4, { distanceKm: 3 }).total;
  const b = computeDriverPayout(F4, { distanceKm: 3.4 }).total;
  assert.equal(a, 6.5);
  assert.equal(b, 7.1); // 5 + 1,4×1,50
  assert.notEqual(a, b);
});

test('fase4: exemplo do enunciado — 3 km, plano Pro → total R$ 7,50', () => {
  const motoboy = computeDriverPayout(F4, { distanceKm: 3 }).total; // 6,50
  const margemPro = 1.0;
  assert.equal(motoboy, 6.5);
  assert.equal(Math.round((motoboy + margemPro) * 100) / 100, 7.5);
});
