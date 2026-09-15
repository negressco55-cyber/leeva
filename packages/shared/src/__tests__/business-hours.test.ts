import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRestaurantOpen, defaultBusinessHours, type BusinessHours } from '../services/business-hours';

// BR = UTC-3 fixo (sem horário de verão). Pra virar 09:00 no Brasil, uso 12:00 UTC.
function brDateTime(isoDateBR: string, hhmmBR: string): Date {
  // isoDateBR: 'YYYY-MM-DD' já no dia local do Brasil; hhmmBR: 'HH:MM' local.
  const [h, m] = hhmmBR.split(':').map(Number);
  return new Date(`${isoDateBR}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`);
}

test('sem horário configurado: sempre aberto', () => {
  assert.equal(isRestaurantOpen(null), true);
  assert.equal(isRestaurantOpen(undefined), true);
});

test('dentro do horário do dia: aberto', () => {
  // 2026-01-15 é uma quinta-feira
  const hours: BusinessHours = { thu: { open: '08:00', close: '22:00', closed: false } };
  assert.equal(isRestaurantOpen(hours, brDateTime('2026-01-15', '12:00')), true);
});

test('fora do horário do dia (antes de abrir / depois de fechar): fechado', () => {
  const hours: BusinessHours = { thu: { open: '08:00', close: '22:00', closed: false } };
  assert.equal(isRestaurantOpen(hours, brDateTime('2026-01-15', '07:00')), false);
  assert.equal(isRestaurantOpen(hours, brDateTime('2026-01-15', '22:30')), false);
});

test('dia marcado como fechado: fechado o dia inteiro, mesmo "dentro do horário"', () => {
  const hours: BusinessHours = { thu: { open: '08:00', close: '22:00', closed: true } };
  assert.equal(isRestaurantOpen(hours, brDateTime('2026-01-15', '12:00')), false);
});

test('dia sem entrada no horário configurado: tratado como fechado', () => {
  const hours: BusinessHours = { fri: { open: '08:00', close: '22:00', closed: false } };
  assert.equal(isRestaurantOpen(hours, brDateTime('2026-01-15', '12:00')), false); // é quinta, só sexta configurada
});

test('janela que vira a noite (ex.: 18h–02h): cobre depois da meia-noite', () => {
  const hours: BusinessHours = { thu: { open: '18:00', close: '02:00', closed: false } };
  assert.equal(isRestaurantOpen(hours, brDateTime('2026-01-15', '23:00')), true);
  assert.equal(isRestaurantOpen(hours, brDateTime('2026-01-15', '01:30')), true); // ainda quinta p/ fins do teste
  assert.equal(isRestaurantOpen(hours, brDateTime('2026-01-15', '10:00')), false);
});

test('open === close: interpretado como aberto 24h nesse dia', () => {
  const hours: BusinessHours = { thu: { open: '00:00', close: '00:00', closed: false } };
  assert.equal(isRestaurantOpen(hours, brDateTime('2026-01-15', '03:00')), true);
  assert.equal(isRestaurantOpen(hours, brDateTime('2026-01-15', '23:59')), true);
});

test('defaultBusinessHours: todo dia 08:00–22:00, nenhum fechado', () => {
  const hours = defaultBusinessHours();
  for (const day of Object.keys(hours) as (keyof BusinessHours)[]) {
    assert.equal(hours[day]!.open, '08:00');
    assert.equal(hours[day]!.close, '22:00');
    assert.equal(hours[day]!.closed, false);
  }
});
