import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrderTextHeuristic, parseMoney } from '../integrations/ai/order-text-parser';

test('parseMoney: formatos brasileiros', () => {
  assert.equal(parseMoney('R$ 1.234,56'), 1234.56);
  assert.equal(parseMoney('45,90'), 45.9);
  assert.equal(parseMoney('45.90'), 45.9);
  assert.equal(parseMoney('R$ 50'), 50);
  assert.equal(parseMoney(''), null);
});

test('colar pedido: estilo Anota AI (dinheiro com troco)', () => {
  const d = parseOrderTextHeuristic(`*Pedido #4821* - Anota AI
👤 Cliente: Maria Souza
📞 Telefone: (83) 99876-5432
📍 Endereço: Rua das Trincheiras, 120
Bairro: Jaguaribe
Complemento: casa azul
Referência: perto da padaria
1x X-Bacon R$ 25,00
1x Coca 2L R$ 12,00
Taxa de entrega: R$ 6,00
Total: R$ 43,00
💵 Pagamento: Dinheiro (troco para R$ 50,00)`);
  assert.equal(d.externalId, '4821');
  assert.equal(d.customerName, 'Maria Souza');
  assert.equal(d.customerPhone, '83998765432');
  assert.ok(d.address?.startsWith('Rua das Trincheiras, 120'), d.address ?? '');
  assert.ok(d.address?.includes('Jaguaribe'));
  assert.ok(d.address?.includes('casa azul'));
  assert.equal(d.total, 43);
  assert.equal(d.deliveryFee, 6);
  assert.equal(d.paymentMethod, 'cash');
  assert.equal(d.paymentStatus, 'pending');
  assert.equal(d.changeFor, 50);
  assert.ok(d.notes?.includes('padaria'));
  assert.equal(d.sourceHint, 'Anota AI');
});

test('colar pedido: pago online não cobra na entrega', () => {
  const d = parseOrderTextHeuristic(`Pedido 1234
Nome: João
Endereço de entrega: Av. Epitácio Pessoa, 1500, Tambaú
Total: R$ 80,00
Forma de pagamento: Pix (pago online)`);
  assert.equal(d.paymentMethod, 'online');
  assert.equal(d.paymentStatus, 'paid');
  assert.equal(d.total, 80);
});

test('colar pedido: maquininha na entrega', () => {
  const d = parseOrderTextHeuristic(`Cliente: Ana
Rua: Rua Silvino Lopes
Número: 33
Bairro: Tambaú
Pagamento: Cartão de crédito (levar maquininha)
Total: 52,50`);
  assert.equal(d.address, 'Rua Silvino Lopes, 33, Tambaú');
  assert.equal(d.paymentMethod, 'card_on_delivery');
  assert.equal(d.total, 52.5);
});
