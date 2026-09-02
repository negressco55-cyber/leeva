/**
 * Testes da Fase 5 — rede de motoboys, push, agrupamento. Fixtures [F5], limpa no fim.
 *
 * Uso: node --import tsx --env-file=apps/restaurante/.env.local scripts/test-fase5.mjs
 *
 * BLOCO A: cadastro self-service + aprovação central + termos.
 */
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {
  isValidCpf,
  createSelfServiceDriver,
  checkDriverGate,
  approveDriver,
  rejectDriver,
  acceptTerms,
  getActiveTerms,
  scoreCandidatesForOrder,
  runDispatchTick,
  savePushSubscription,
  saveExpoPushToken,
  deletePushSubscription,
  sendPushToMotoboy,
  notifyDriver,
} from '../packages/shared/src/services/index.ts';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let pass = 0,
  fail = 0;
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
const cleanup = [];
let ADMIN; // id real de um auth.user (approved_by tem FK)

// CPFs válidos de teste (dígito verificador correto, gerados)
const VALID_CPF = ['52998224725', '11144477735'];

async function mkDriver(cpf, extra = {}) {
  const u = crypto.randomUUID();
  const res = await createSelfServiceDriver(db, {
    userId: null, // sem auth user no teste (coluna nullable)
    fullName: '[F5] Motoboy',
    phone: `f5${Math.random()}`.replace('.', '').slice(0, 15),
    cpf,
    city: 'João Pessoa - PB',
    pixKey: 'motoboy@f5.dev',
    pixKeyType: 'email',
    ...extra,
  });
  if (res.ok) cleanup.push(() => db.from('motoboys').delete().eq('id', res.motoboyId));
  return res;
}

async function main() {
  ADMIN = (await db.auth.admin.listUsers({ perPage: 50 })).data.users.find((u) => u.email === 'admin@leeva.dev')?.id;
  assert.ok(ADMIN, 'rode scripts/seed-admin.mjs');

  // ---------------------------------------------------------------
  // CPF
  // ---------------------------------------------------------------
  await t('CPF: valida dígito verificador', () => {
    assert.equal(isValidCpf('529.982.247-25'), true);
    assert.equal(isValidCpf('52998224725'), true);
    assert.equal(isValidCpf('11111111111'), false); // todos iguais
    assert.equal(isValidCpf('52998224724'), false); // dígito errado
    assert.equal(isValidCpf('123'), false);
  });

  // ---------------------------------------------------------------
  // CADASTRO SELF-SERVICE
  // ---------------------------------------------------------------
  let d1;
  await t('cadastro: nasce pending_approval, fleet=leeva, sem restaurante', async () => {
    const res = await mkDriver(VALID_CPF[0]);
    assert.ok(res.ok, res.error);
    d1 = res.motoboyId;
    const { data: m } = await db
      .from('motoboys')
      .select('approval_status, fleet, restaurant_id, signup_source, status')
      .eq('id', d1)
      .single();
    assert.equal(m.approval_status, 'pending_approval');
    assert.equal(m.fleet, 'leeva');
    assert.equal(m.restaurant_id, null);
    assert.equal(m.signup_source, 'self_service');
    assert.equal(m.status, 'offline');
  });

  await t('cadastro: CPF inválido é recusado', async () => {
    const res = await mkDriver('12345678900');
    assert.equal(res.ok, false);
    assert.match(res.error, /CPF/i);
  });

  await t('cadastro: CPF duplicado é recusado', async () => {
    const res = await mkDriver(VALID_CPF[0]); // mesmo do d1
    assert.equal(res.ok, false);
    assert.match(res.error, /CPF/i);
  });

  // ---------------------------------------------------------------
  // GATE (aprovação + termos)
  // ---------------------------------------------------------------
  await t('gate: pending_approval → não pode ficar online', async () => {
    const g = await checkDriverGate(db, d1);
    assert.equal(g.ok, false);
    assert.equal(g.reason, 'pending_approval');
  });

  await t('gate: rejeitado → não pode, com motivo', async () => {
    const res = await mkDriver(VALID_CPF[1]);
    await rejectDriver(db, res.motoboyId, ADMIN, 'documento ilegível');
    const g = await checkDriverGate(db, res.motoboyId);
    assert.equal(g.ok, false);
    assert.equal(g.reason, 'rejected');
    assert.match(g.message, /ilegível/);
  });

  await t('gate: aprovado mas sem aceitar termos → reason=terms', async () => {
    await approveDriver(db, d1, ADMIN);
    const { data: m } = await db.from('motoboys').select('approval_status').eq('id', d1).single();
    assert.equal(m.approval_status, 'approved');
    const g = await checkDriverGate(db, d1);
    assert.equal(g.ok, false);
    assert.equal(g.reason, 'terms');
  });

  await t('gate: aprovado + termos aceitos → ok', async () => {
    const terms = await getActiveTerms(db);
    await acceptTerms(db, d1, terms.version, '1.2.3.4');
    const g = await checkDriverGate(db, d1);
    assert.equal(g.ok, true);
    // registrou o aceite com IP
    const { data: acc } = await db
      .from('driver_terms_acceptance')
      .select('ip, terms_version')
      .eq('motoboy_id', d1)
      .single();
    assert.equal(acc.ip, '1.2.3.4');
    assert.equal(acc.terms_version, terms.version);
  });

  // ---------------------------------------------------------------
  // DISPATCH POOL
  // ---------------------------------------------------------------
  await t('despacho: só motoboy aprovado + termos entra no pool', async () => {
    const { data: rst } = await db
      .from('restaurants')
      .insert({ name: '[F5] R', latitude: -7.115, longitude: -34.845, fleet_mode: 'leeva', onboarding_completed: true })
      .select('id')
      .single();
    cleanup.push(() => db.from('restaurants').delete().eq('id', rst.id));

    // d1 = aprovado+termos ; dPending = pendente ; ambos disponíveis + com localização
    const dPending = (await mkDriver('39053344705')).motoboyId;
    await db
      .from('motoboys')
      .update({ status: 'available', current_latitude: -7.114, current_longitude: -34.844, location_updated_at: new Date().toISOString() })
      .in('id', [d1, dPending]);

    const { data: o } = await db
      .from('orders')
      .insert({ restaurant_id: rst.id, customer_name: 'C', customer_address: 'Rua - Bessa', latitude: -7.108, longitude: -34.836, order_amount: 30, delivery_fee: 0, status: 'ready', dispatch_state: 'none', notes: '[F5]' })
      .select('id')
      .single();
    cleanup.push(() => db.from('orders').delete().eq('id', o.id));

    const { candidates } = await scoreCandidatesForOrder(db, o.id);
    const ids = candidates.map((c) => c.motoboyId);
    assert.ok(ids.includes(d1), 'aprovado+termos deveria estar no pool');
    assert.ok(!ids.includes(dPending), 'pendente NÃO deveria estar no pool');
  });

  await t('termos: nova versão publicada → quem aceitou a antiga sai do pool até re-aceitar', async () => {
    const { data: rst } = await db
      .from('restaurants')
      .insert({ name: '[F5] R2', latitude: -7.115, longitude: -34.845, fleet_mode: 'leeva', onboarding_completed: true })
      .select('id')
      .single();
    cleanup.push(() => db.from('restaurants').delete().eq('id', rst.id));

    // publica termos v2
    await db.from('terms_versions').update({ active: false }).eq('version', 1);
    const { data: v2 } = await db
      .from('terms_versions')
      .insert({ version: 999, content: '[F5] termos v999', active: true })
      .select('version')
      .single();
    cleanup.push(async () => {
      // ordem importa: aceites referenciam a versão (FK) → apaga primeiro
      await db.from('driver_terms_acceptance').delete().eq('terms_version', 999);
      await db.from('terms_versions').update({ active: true }).eq('version', 1);
      await db.from('terms_versions').delete().eq('version', 999);
      await db.from('motoboys').update({ terms_accepted_version: 1 }).eq('terms_accepted_version', 999);
    });

    // d1 aceitou a v1 → agora precisa da v999
    const g = await checkDriverGate(db, d1);
    assert.equal(g.reason, 'terms');

    const { data: o } = await db
      .from('orders')
      .insert({ restaurant_id: rst.id, customer_name: 'C', customer_address: 'Rua - Bessa', latitude: -7.108, longitude: -34.836, order_amount: 30, delivery_fee: 0, status: 'ready', dispatch_state: 'none', notes: '[F5]' })
      .select('id')
      .single();
    cleanup.push(() => db.from('orders').delete().eq('id', o.id));
    await db.from('motoboys').update({ status: 'available' }).eq('id', d1);

    const { candidates } = await scoreCandidatesForOrder(db, o.id);
    assert.ok(!candidates.map((c) => c.motoboyId).includes(d1), 'sem re-aceite não deveria estar no pool');

    // re-aceita v999 → volta
    await acceptTerms(db, d1, 999, null);
    const { candidates: c2 } = await scoreCandidatesForOrder(db, o.id);
    assert.ok(c2.map((c) => c.motoboyId).includes(d1), 're-aceitou → volta ao pool');
  });

  // ---------------------------------------------------------------
  // BLOCO B — Web Push
  // ---------------------------------------------------------------
  const FAKE_SUB = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/f5-fake-' + crypto.randomUUID(),
    keys: {
      p256dh: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
      auth: 'k8JV6sjdbhAiSg2Lq9nA9A',
    },
  };

  await t('push: salva subscription e liga push_enabled', async () => {
    const r = await savePushSubscription(db, d1, FAKE_SUB);
    assert.ok(r.ok, r.error);
    const { data: m } = await db.from('motoboys').select('push_enabled').eq('id', d1).single();
    assert.equal(m.push_enabled, true);
    const { count } = await db
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('motoboy_id', d1);
    assert.equal(count, 1);
  });

  await t('push: subscription duplicada (mesmo endpoint) não cria linha nova', async () => {
    await savePushSubscription(db, d1, FAKE_SUB);
    const { count } = await db
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('motoboy_id', d1);
    assert.equal(count, 1);
  });

  await t('push: envio a endpoint inválido não lança e contabiliza falha/remoção', async () => {
    const r = await sendPushToMotoboy(db, d1, { title: 'x', body: 'y' });
    // endpoint fake: web-push devolve 4xx → ou remove (404/410) ou incrementa failure_count
    assert.equal(r.ok, false);
    assert.equal(typeof r.sent, 'number');
  });

  await t('push: remover subscription desliga push_enabled quando era a última', async () => {
    // garante estado limpo: recria e remove
    await savePushSubscription(db, d1, FAKE_SUB);
    await deletePushSubscription(db, d1, FAKE_SUB.endpoint);
    const { data: m } = await db.from('motoboys').select('push_enabled').eq('id', d1).single();
    assert.equal(m.push_enabled, false);
  });

  await t('push: sendPushToMotoboy sem dispositivos devolve erro tratado', async () => {
    const r = await sendPushToMotoboy(db, d1, { title: 'x', body: 'y' });
    assert.equal(r.ok, false);
    assert.match(r.error ?? '', /dispositivo|VAPID/i);
  });

  await t('push nativo: saveExpoPushToken cria linha kind=expo e liga push_enabled', async () => {
    const token = `ExponentPushToken[f5-${crypto.randomUUID()}]`;
    const r = await saveExpoPushToken(db, d1, token);
    assert.ok(r.ok, r.error);
    const { data: sub } = await db
      .from('push_subscriptions')
      .select('kind, p256dh, auth')
      .eq('endpoint', token)
      .single();
    assert.equal(sub.kind, 'expo');
    assert.equal(sub.p256dh, null);
    const { data: m } = await db.from('motoboys').select('push_enabled').eq('id', d1).single();
    assert.equal(m.push_enabled, true);
    cleanup.push(() => db.from('push_subscriptions').delete().eq('endpoint', token));
  });

  await t('push nativo: token Expo malformado é recusado', async () => {
    const r = await saveExpoPushToken(db, d1, 'nao-e-um-token-expo');
    assert.equal(r.ok, false);
  });

  await t('push nativo: sendPushToMotoboy tenta o Expo Push Service e não lança', async () => {
    const token = `ExponentPushToken[f5-${crypto.randomUUID()}]`;
    await saveExpoPushToken(db, d1, token);
    cleanup.push(() => db.from('push_subscriptions').delete().eq('endpoint', token));
    // token fake → Expo devolve "DeviceNotRegistered" ou erro; a função trata
    const r = await sendPushToMotoboy(db, d1, { title: 'x', body: 'y', tag: 'offer' });
    assert.equal(typeof r.sent, 'number');
    assert.equal(typeof r.removed, 'number');
  });

  await t('notifyDriver: grava in-app quando há restaurantId', async () => {
    const { data: rst } = await db
      .from('restaurants')
      .insert({ name: '[F5] Rn', latitude: -7.11, longitude: -34.84, fleet_mode: 'leeva', onboarding_completed: true })
      .select('id')
      .single();
    cleanup.push(() => db.from('restaurants').delete().eq('id', rst.id));
    await notifyDriver(db, {
      motoboyId: d1,
      restaurantId: rst.id,
      kind: 'offer_cancelled',
      title: 'Entrega cancelada',
      body: 'teste',
    });
    const { data: n } = await db
      .from('notifications')
      .select('id, template, recipient')
      .eq('recipient', d1)
      .eq('template', 'motoboy.offer_cancelled')
      .limit(1);
    assert.ok(n?.length, 'deveria ter gravado a notificação in-app');
    cleanup.push(() => db.from('notifications').delete().eq('recipient', d1).eq('template', 'motoboy.offer_cancelled'));
  });
}

main()
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
    console.log(`\n${pass} passaram, ${fail} falharam`);
    process.exit(fail ? 1 : 0);
  });
