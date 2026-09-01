import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StraightLineRoutingService, HybridRoutingService, type RoutingService } from '../services/routing';

test('StraightLineRoutingService: leg devolve distância e tempo estimados', async () => {
  const svc = new StraightLineRoutingService();
  const leg = await svc.leg({ latitude: -7.11, longitude: -34.84 }, { latitude: -7.09, longitude: -34.83 });
  assert.ok(leg);
  assert.ok(leg!.isEstimate);
  assert.ok(leg!.distanceKm > 2 && leg!.distanceKm < 4, `dist ${leg!.distanceKm}`);
  assert.ok(leg!.durationMin > 5 && leg!.durationMin < 15);
});

test('StraightLineRoutingService: route soma as pernas', async () => {
  const svc = new StraightLineRoutingService();
  const plan = await svc.route([
    { latitude: -7.11, longitude: -34.84 },
    { latitude: -7.09, longitude: -34.83 },
    { latitude: -7.08, longitude: -34.84 },
  ]);
  assert.ok(plan);
  assert.equal(plan!.legs.length, 2);
  assert.ok(
    Math.abs(plan!.totalDistanceKm - (plan!.legs[0]!.distanceKm + plan!.legs[1]!.distanceKm)) < 1e-6,
  );
});

test('route: < 2 pontos = null', async () => {
  const svc = new StraightLineRoutingService();
  assert.equal(await svc.route([{ latitude: 0, longitude: 0 }]), null);
});

test('HybridRoutingService: usa o provedor real quando ele responde', async () => {
  const fake: RoutingService = {
    provider: 'fake',
    isEstimate: false,
    async leg() {
      return { distanceKm: 42, durationMin: 10, isEstimate: false, provider: 'fake' };
    },
    async route() {
      return null;
    },
  };
  const svc = new HybridRoutingService(fake);
  const leg = await svc.leg({ latitude: -7.11, longitude: -34.84 }, { latitude: -7.09, longitude: -34.83 });
  assert.equal(leg!.distanceKm, 42);
  assert.equal(leg!.isEstimate, false);
});

test('HybridRoutingService: cai para linha reta quando o provedor real falha', async () => {
  const broken: RoutingService = {
    provider: 'broken',
    isEstimate: false,
    async leg() {
      throw new Error('rate limit');
    },
    async route() {
      throw new Error('down');
    },
  };
  const svc = new HybridRoutingService(broken);
  const leg = await svc.leg({ latitude: -7.11, longitude: -34.84 }, { latitude: -7.09, longitude: -34.83 });
  assert.ok(leg, 'deveria ter fallback');
  assert.equal(leg!.isEstimate, true, 'fallback é estimativa');
  assert.ok(leg!.distanceKm > 2 && leg!.distanceKm < 4);
});

test('HybridRoutingService: cacheia a mesma perna', async () => {
  let calls = 0;
  const counting: RoutingService = {
    provider: 'count',
    isEstimate: false,
    async leg() {
      calls++;
      return { distanceKm: 1, durationMin: 1, isEstimate: false, provider: 'count' };
    },
    async route() {
      return null;
    },
  };
  const svc = new HybridRoutingService(counting);
  const a = { latitude: -7.111, longitude: -34.841 };
  const b = { latitude: -7.092, longitude: -34.832 };
  await svc.leg(a, b);
  await svc.leg(a, b);
  assert.equal(calls, 1);
});
