import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePrepStatus } from '../services/prep-status';

test('prep status: nunca marcado em preparo → none', () => {
  const r = computePrepStatus({ readyAt: null, preparingAt: null, prepEstimateMinutes: null });
  assert.equal(r.state, 'none');
});

test('prep status: pronto (ready_at setado) tem prioridade sobre tudo', () => {
  const r = computePrepStatus({ readyAt: '2026-01-01T12:00:00Z', preparingAt: '2026-01-01T11:00:00Z', prepEstimateMinutes: 15 });
  assert.equal(r.state, 'ready');
  assert.match(r.state === 'ready' ? r.label : '', /Pronto/);
});

test('prep status: em preparo sem estimativa não calcula contagem', () => {
  const r = computePrepStatus({ readyAt: null, preparingAt: '2026-01-01T11:00:00Z', prepEstimateMinutes: null });
  assert.equal(r.state, 'preparing');
  assert.equal(r.state === 'preparing' ? r.minutesLeft : undefined, null);
  assert.equal(r.state === 'preparing' ? r.label : '', 'Em preparo');
});

test('prep status: em preparo com tempo restante positivo', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  const preparingAt = new Date('2026-01-01T12:00:00Z').toISOString(); // agora mesmo
  const r = computePrepStatus({ readyAt: null, preparingAt, prepEstimateMinutes: 15 }, now);
  assert.equal(r.state, 'preparing');
  assert.equal(r.state === 'preparing' ? r.minutesLeft : null, 15);
  assert.match(r.state === 'preparing' ? r.label : '', /~15 min/);
});

test('prep status: estimativa já vencida (deveria estar pronto)', () => {
  const now = new Date('2026-01-01T12:30:00Z');
  const preparingAt = new Date('2026-01-01T12:00:00Z').toISOString();
  const r = computePrepStatus({ readyAt: null, preparingAt, prepEstimateMinutes: 15 }, now);
  assert.equal(r.state, 'preparing');
  assert.ok((r.state === 'preparing' ? r.minutesLeft ?? 0 : 0) <= 0);
  assert.match(r.state === 'preparing' ? r.label : '', /já deveria estar pronto/);
});
