import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDeliveryToFlat, openDeliveryEvent } from '../integrations/opendelivery';

test('open delivery: pedido pago online vira entrega paga', () => {
  const f = openDeliveryToFlat({
    orderId: 'ORDER-1',
    orderDisplayId: '1234',
    customerName: 'João Silva',
    customerPhone: '+5583999999999',
    deliveryAddress: {
      street: 'Av. Epitácio Pessoa',
      number: '1500',
      district: 'Tambaú',
      city: 'João Pessoa',
      state: 'PB',
      complement: 'apto 302',
      latitude: -7.115,
      longitude: -34.83,
      instructions: 'interfone 302',
    },
    totalOrderPrice: { value: 45.5, currency: 'BRL' },
    orderDeliveryFee: { value: 8.5, currency: 'BRL' },
    payments: { method: 'ONLINE', wirelessPos: false },
  });
  assert.equal(f.external_order_id, 'ORDER-1');
  assert.equal(f.customer_name, 'João Silva');
  assert.equal(f.address, 'Av. Epitácio Pessoa, 1500, Tambaú, João Pessoa, PB (apto 302)');
  assert.equal(f.latitude, -7.115);
  assert.equal(f.payment_method, 'online');
  assert.equal(f.payment_status, 'paid');
  assert.equal(f.order_value, 45.5);
  assert.ok(String(f.notes).includes('#1234'));
  assert.ok(String(f.notes).includes('interfone'));
});

test('open delivery: OFFLINE com maquininha = cartão na entrega', () => {
  const f = openDeliveryToFlat({
    orderId: 'X',
    customerName: 'Ana',
    deliveryAddress: { formattedAddress: 'Rua A, 10, Bessa' },
    payments: { method: 'OFFLINE', wirelessPos: true },
  });
  assert.equal(f.payment_method, 'card_on_delivery');
  assert.equal(f.payment_status, 'pending');
});

test('open delivery: OFFLINE sem maquininha = dinheiro, com troco nas observações', () => {
  const f = openDeliveryToFlat({
    orderId: 'Y',
    customerName: 'Bia',
    deliveryAddress: { formattedAddress: 'Rua B, 20' },
    payments: { method: 'OFFLINE', changeFor: { value: 100 } },
  });
  assert.equal(f.payment_method, 'cash');
  assert.ok(String(f.notes).includes('Troco para R$ 100,00'));
});

test('open delivery: status do Leeva vira evento', () => {
  assert.equal(openDeliveryEvent('waiting_dispatch'), 'PENDING');
  assert.equal(openDeliveryEvent('assigned'), 'ACCEPTED');
  assert.equal(openDeliveryEvent('delivered'), 'ORDER_DELIVERED');
  assert.equal(openDeliveryEvent('cancelled'), 'CANCELLED');
});
