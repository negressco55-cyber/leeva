/**
 * Testes da lógica pura de envio de localização (segundo plano).
 * Roda com: node --test  (Node 24 faz type-stripping do .ts importado)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLocationBody, lastLocation, shouldThrottle } from '../locationPayload.ts';

test('shouldThrottle: bloqueia dentro do intervalo, libera fora', () => {
  assert.equal(shouldThrottle(1000, 0, 8000), true); // 1s < 8s
  assert.equal(shouldThrottle(8000, 0, 8000), false); // exatamente no limite
  assert.equal(shouldThrottle(9000, 0, 8000), false); // 9s > 8s
  assert.equal(shouldThrottle(5000, 4000, 8000), true); // 1s desde o último
});

test('buildLocationBody: mapeia coords e troca null por undefined', () => {
  assert.deepEqual(buildLocationBody({ latitude: -7.11, longitude: -34.84, accuracy: 12, speed: 3 }), {
    latitude: -7.11,
    longitude: -34.84,
    accuracy: 12,
    speed: 3,
  });
  assert.deepEqual(buildLocationBody({ latitude: -7.11, longitude: -34.84, accuracy: null, speed: null }), {
    latitude: -7.11,
    longitude: -34.84,
    accuracy: undefined,
    speed: undefined,
  });
});

test('lastLocation: pega a leitura mais recente do lote', () => {
  assert.equal(lastLocation(null), null);
  assert.equal(lastLocation([]), null);
  const batch = [
    { coords: { latitude: 1, longitude: 1 } },
    { coords: { latitude: 2, longitude: 2 } },
  ];
  assert.equal(lastLocation(batch), batch[1]);
});
