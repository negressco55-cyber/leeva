/**
 * Testes da compra de crédito via Pix (Asaas). Fixtures [ASA], limpa no fim.
 * NÃO toca a Asaas de verdade — injeta um cliente fake (__setAsaasClient).
 *
 * Uso: node --import tsx --env-file=apps/restaurante/.env.local scripts/test-asaas.mjs
 *
 * Requer a migration 0031_asaas_credit_purchases.sql aplicada.
 */
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {
  __setAsaasClient,
  startCreditPurchase,
  confirmCreditPurchase,
  failCreditPurchase,
  listCreditPurchases,
  getCreditBalance,
} from '../packages/shared/src/services/index.ts';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let pass = 0;
let fail = 0;
const cleanup = [];
const t = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (e) {
    console.log(`  ✗ ${name}\n    ${e.message}`);
    fail++;
  }
};

// cliente Asaas fake: cada cobrança gera um id sequencial; nunca chama a rede.
let seq = 0;
const fakeCharges = new Map();
const fakeAsaas = {
  async createPixCharge(input) {
    seq++;
    const id = `pay_fake_${seq}`;
    fakeCharges.set(id, input);
    return { ok: true, data: { id, invoiceUrl: `https://fake/${id}`, pixCopyPaste: `000201${id}` } };
  },
  async transferPix() {
    return { ok: false, error: 'não usado neste teste' };
  },
};

const run = async () => {
  const { data: r } = await db
    .from('restaurants')
    .insert({ name: '[ASA] R', latitude: -7.115, longitude: -34.845, fleet_mode: 'leeva', onboarding_completed: true })
    .select('id')
    .single();
  cleanup.push(() => db.from('credit_purchases').delete().eq('restaurant_id', r.id));
  cleanup.push(() => db.from('credit_ledger').delete().eq('restaurant_id', r.id));
  cleanup.push(() => db.from('restaurant_credits').delete().eq('restaurant_id', r.id));
  cleanup.push(() => db.from('restaurants').delete().eq('id', r.id));

  console.log('\nMODO SIMULAÇÃO (sem Asaas)');
  __setAsaasClient(null);

  await t('compra simulada credita na hora', async () => {
    const res = await startCreditPurchase(db, r.id, { amount: 30 });
    assert.equal(res.ok, true);
    assert.equal(res.simulated, true);
    assert.equal(res.status, 'paid');
    const { balance } = await getCreditBalance(db, r.id);
    assert.equal(balance, 30);
  });

  await t('valor abaixo do mínimo é recusado', async () => {
    const res = await startCreditPurchase(db, r.id, { amount: 2 });
    assert.equal(res.ok, false);
  });

  console.log('\nMODO PIX REAL (cliente Asaas fake)');
  __setAsaasClient(fakeAsaas);

  let purchaseId;
  let externalId;

  await t('compra real fica pendente e NÃO credita ainda', async () => {
    const before = (await getCreditBalance(db, r.id)).balance;
    const res = await startCreditPurchase(db, r.id, { amount: 50 });
    assert.equal(res.ok, true);
    assert.equal(res.simulated, false);
    assert.equal(res.status, 'pending');
    assert.ok(res.invoiceUrl, 'deve ter invoiceUrl');
    assert.ok(res.pixCopyPaste, 'deve ter copia-e-cola');
    purchaseId = res.purchaseId;
    const after = (await getCreditBalance(db, r.id)).balance;
    assert.equal(after, before, 'saldo não muda antes do pagamento');
    const { data: row } = await db.from('credit_purchases').select('external_id, status').eq('id', purchaseId).single();
    assert.equal(row.status, 'pending');
    externalId = row.external_id;
    assert.ok(externalId?.startsWith('pay_fake_'));
  });

  await t('webhook confirma -> credita o valor', async () => {
    const before = (await getCreditBalance(db, r.id)).balance;
    const res = await confirmCreditPurchase(db, { externalId });
    assert.equal(res.ok, true);
    assert.equal(res.balance, before + 50);
    const { data: row } = await db.from('credit_purchases').select('status, paid_at').eq('id', purchaseId).single();
    assert.equal(row.status, 'paid');
    assert.ok(row.paid_at);
  });

  await t('webhook duplicado NÃO credita de novo (idempotente)', async () => {
    const before = (await getCreditBalance(db, r.id)).balance;
    const res = await confirmCreditPurchase(db, { externalId });
    assert.equal(res.ok, true);
    assert.equal(res.alreadyPaid, true);
    const after = (await getCreditBalance(db, r.id)).balance;
    assert.equal(after, before, 'saldo não muda no reenvio');
  });

  await t('pacote com bônus credita valor + bônus', async () => {
    const { data: pkg } = await db
      .from('credit_packages')
      .insert({ amount: 100, bonus: 15, label: '[ASA] pacote', active: true, sort_order: 999 })
      .select('id')
      .single();
    cleanup.push(() => db.from('credit_packages').delete().eq('id', pkg.id));
    const before = (await getCreditBalance(db, r.id)).balance;
    const res = await startCreditPurchase(db, r.id, { packageId: pkg.id });
    assert.equal(res.status, 'pending');
    const { data: row } = await db.from('credit_purchases').select('external_id').eq('id', res.purchaseId).single();
    await confirmCreditPurchase(db, { externalId: row.external_id });
    const after = (await getCreditBalance(db, r.id)).balance;
    assert.equal(after, before + 115);
  });

  await t('Pix vencido marca a compra como expirada', async () => {
    const res = await startCreditPurchase(db, r.id, { amount: 20 });
    const { data: row } = await db.from('credit_purchases').select('external_id').eq('id', res.purchaseId).single();
    await failCreditPurchase(db, { externalId: row.external_id }, 'expired');
    const { data: after } = await db.from('credit_purchases').select('status').eq('id', res.purchaseId).single();
    assert.equal(after.status, 'expired');
  });

  await t('confirmar uma compra expirada credita mesmo assim (pagou fora do prazo)', async () => {
    // Asaas ainda pode confirmar um pagamento atrasado; não perdemos o dinheiro do cliente.
    const res = await startCreditPurchase(db, r.id, { amount: 25 });
    const { data: row } = await db.from('credit_purchases').select('external_id').eq('id', res.purchaseId).single();
    await failCreditPurchase(db, { externalId: row.external_id }, 'expired');
    const before = (await getCreditBalance(db, r.id)).balance;
    const c = await confirmCreditPurchase(db, { externalId: row.external_id });
    assert.equal(c.ok, true);
    assert.equal((await getCreditBalance(db, r.id)).balance, before + 25);
  });

  await t('listCreditPurchases devolve o histórico', async () => {
    const list = await listCreditPurchases(db, r.id, 20);
    assert.ok(list.length >= 4);
    assert.ok(list.every((p) => typeof p.status === 'string'));
  });
};

run()
  .catch((e) => {
    console.error(e);
    fail++;
  })
  .finally(async () => {
    for (const c of cleanup.reverse()) {
      try {
        await c();
      } catch {
        /* ignora */
      }
    }
    __setAsaasClient(undefined);
    console.log(`\n${pass} passaram, ${fail} falharam`);
    process.exit(fail ? 1 : 0);
  });
