import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, nextOrderStatus, ORDER_STATUS_FLOW } from '../constants';
import { parseWhatsAppOrder } from '../integrations/ai/whatsapp-parser';
import { hmacSha256Hex, timingSafeEqualHex, randomToken, sha256Hex } from '../lib/crypto';
import { ManualOrderProvider } from '../integrations/manual';

test('máquina de estados: transições válidas e inválidas', () => {
  assert.equal(canTransition('waiting_dispatch', 'preparing'), true);
  assert.equal(canTransition('ready', 'assigned'), true);
  assert.equal(canTransition('in_route', 'delivered'), true);
  assert.equal(canTransition('delivered', 'in_route'), false);
  assert.equal(canTransition('waiting_dispatch', 'delivered'), false);
  assert.equal(canTransition('cancelled', 'preparing'), false);
});

test('nextOrderStatus segue o fluxo feliz', () => {
  assert.equal(nextOrderStatus('waiting_dispatch'), 'preparing');
  assert.equal(nextOrderStatus('in_route'), 'delivered');
  assert.equal(nextOrderStatus('delivered'), null);
  assert.equal(ORDER_STATUS_FLOW.length, 7);
});

test('parseWhatsAppOrder (heurística): extrai itens e endereço', async () => {
  const r = await parseWhatsAppOrder('Quero dois brownies e um copo supremo para entregar no Bessa', {
    menu: [
      { name: 'Brownie', price: 8 },
      { name: 'Copo Supremo', price: 15 },
    ],
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.draft.needsConfirmation, true);
    const brownie = r.draft.items.find((i) => i.name === 'Brownie');
    assert.equal(brownie?.quantity, 2);
    const copo = r.draft.items.find((i) => i.name === 'Copo Supremo');
    assert.equal(copo?.quantity, 1);
    assert.match(r.draft.rawInterpretation, /Brownie/);
  }
});

test('parseWhatsAppOrder: mensagem sem itens = erro (vai pro atendimento manual)', async () => {
  const r = await parseWhatsAppOrder('bom dia, tudo bem?', {});
  assert.equal(r.ok, false);
});

test('crypto: HMAC estável e comparação segura', async () => {
  const a = await hmacSha256Hex('segredo', 'payload');
  const b = await hmacSha256Hex('segredo', 'payload');
  assert.equal(a, b);
  assert.equal(timingSafeEqualHex(a, b), true);
  assert.equal(timingSafeEqualHex(a, 'sha256=' + b), true);
  assert.equal(timingSafeEqualHex(a, 'deadbeef'), false);
});

test('crypto: randomToken tem o tamanho pedido e é hex', () => {
  const t = randomToken(24);
  assert.equal(t.length, 48);
  assert.match(t, /^[0-9a-f]+$/);
  assert.notEqual(randomToken(24), randomToken(24));
});

test('sha256Hex: hash conhecido de "abc"', async () => {
  assert.equal(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('ManualOrderProvider: normaliza um pedido válido', async () => {
  const p = new ManualOrderProvider();
  const r = await p.parse({
    customerName: 'Fulano',
    address: 'Rua A, 1 - Bessa',
    items: [{ name: 'Pizza', quantity: 1, unitPrice: 40 }],
    deliveryFee: 8,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.order.source, 'manual');
    assert.equal(r.order.total, 40);
    assert.equal(r.order.deliveryFee, 8);
    assert.equal(r.order.customer.name, 'Fulano');
  }
});

test('ManualOrderProvider: recusa sem nome/endereço', async () => {
  const p = new ManualOrderProvider();
  assert.equal((await p.parse({ address: 'x', items: [] })).ok, false);
  assert.equal((await p.parse({ customerName: 'y', items: [] })).ok, false);
});
