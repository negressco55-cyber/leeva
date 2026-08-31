import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, minutesForKm, regionFromAddress, centroid } from '../services/geo';

test('haversineKm: mesma coordenada = 0', () => {
  assert.equal(haversineKm({ latitude: -7.11, longitude: -34.84 }, { latitude: -7.11, longitude: -34.84 }), 0);
});

test('haversineKm: ~1 grau de latitude ≈ 111 km', () => {
  const d = haversineKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })!;
  assert.ok(Math.abs(d - 111.19) < 1, `esperado ~111, veio ${d}`);
});

test('haversineKm: null quando falta coordenada', () => {
  assert.equal(haversineKm(null, { latitude: 1, longitude: 1 }), null);
  assert.equal(haversineKm({ latitude: 1, longitude: 1 }, undefined), null);
});

test('minutesForKm: 22 km a 22 km/h = 60 min', () => {
  assert.equal(Math.round(minutesForKm(22, 22)), 60);
});

test('regionFromAddress: extrai o bairro', () => {
  assert.equal(regionFromAddress('Rua X, 123, Manaíra, João Pessoa'), 'Manaíra');
  assert.equal(regionFromAddress('Bessa'), 'Bessa');
  assert.equal(regionFromAddress(null), null);
});

test('centroid: média dos pontos', () => {
  const c = centroid([
    { latitude: 0, longitude: 0 },
    { latitude: 2, longitude: 4 },
  ])!;
  assert.equal(c.latitude, 1);
  assert.equal(c.longitude, 2);
});
