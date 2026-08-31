import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StraightLineRoutingService } from '../services/routing';

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
