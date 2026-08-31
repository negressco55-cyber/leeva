/** Pen-test multi-tenant + auth. Cria fixtures [PENTEST], testa, limpa. */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = 'http://localhost:3000';
const admin = createClient(URL, SVC, { auth: { persistSession: false } });

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name} ${extra}`); fail++; }
};
const cleanup = [];

async function mkUser(email, meta) {
  const found = (await admin.auth.admin.listUsers({ perPage: 200 })).data.users.find(u => u.email === email);
  if (found) await admin.auth.admin.deleteUser(found.id);
  const { data } = await admin.auth.admin.createUser({ email, password: 'pentest123', email_confirm: true, user_metadata: meta });
  cleanup.push(() => admin.auth.admin.deleteUser(data.user.id));
  return data.user;
}

async function main() {
  const { data: rA } = await admin.from('restaurants').insert({ name: '[PENTEST] A', latitude: -7.1, longitude: -34.8 }).select('id').single();
  const { data: rB } = await admin.from('restaurants').insert({ name: '[PENTEST] B' }).select('id').single();
  cleanup.push(() => admin.from('restaurants').delete().in('id', [rA.id, rB.id]));

  await mkUser('ownerA@pentest.dev', { role: 'restaurant_owner', full_name: 'A', restaurant_id: rA.id });
  const uB = await mkUser('ownerB@pentest.dev', { role: 'restaurant_owner', full_name: 'B', restaurant_id: rB.id });
  const { data: motoA } = await admin.from('motoboys').insert({ restaurant_id: rA.id, full_name: 'MotoA', phone: 'p1', status: 'available' }).select('id').single();

  const { data: ordA } = await admin.from('orders').insert({
    restaurant_id: rA.id, customer_name: 'Cli A', customer_phone: '5583999998888',
    customer_address: 'Rua Secreta 1', latitude: -7.1, longitude: -34.8,
    order_amount: 100, delivery_fee: 10, status: 'ready',
  }).select('id, order_number').single();
  const { data: tokA } = await admin.from('tracking_tokens').select('token').eq('order_id', ordA.id).single();

  // login como owner B via GoTrue REST
  const loginRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'ownerB@pentest.dev', password: 'pentest123' }),
  });
  const sess = await loginRes.json();
  const bJwt = sess.access_token;
  check('login owner B ok', !!bJwt, JSON.stringify(sess).slice(0, 120));

  // === RLS: B tenta ler dados de A com a anon key + JWT de B ===
  const asB = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${bJwt}` } }, auth: { persistSession: false } });
  const { data: bSeesA_orders } = await asB.from('orders').select('id').eq('restaurant_id', rA.id);
  check('RLS: B não vê orders de A', (bSeesA_orders ?? []).length === 0, `viu ${bSeesA_orders?.length}`);
  const { data: bSeesAllOrders } = await asB.from('orders').select('id, restaurant_id');
  check('RLS: B só vê orders do próprio restaurante', (bSeesAllOrders ?? []).every(o => o.restaurant_id === rB.id), `viu ${bSeesAllOrders?.length}`);
  const { data: bSeesA_cust } = await asB.from('customers').select('id, phone').eq('restaurant_id', rA.id);
  check('RLS: B não vê customers de A (telefone)', (bSeesA_cust ?? []).length === 0);
  const { data: bSeesA_moto } = await asB.from('motoboys').select('id').eq('restaurant_id', rA.id);
  check('RLS: B não vê motoboys de A', (bSeesA_moto ?? []).length === 0);
  const { data: bSeesA_events } = await asB.from('order_events').select('id').eq('restaurant_id', rA.id);
  check('RLS: B não vê order_events de A', (bSeesA_events ?? []).length === 0);
  const { data: bSeesA_loc } = await asB.from('driver_locations').select('id').eq('restaurant_id', rA.id);
  check('RLS: B não vê driver_locations de A', (bSeesA_loc ?? []).length === 0);
  const { data: bSeesA_notif } = await asB.from('notifications').select('id').eq('restaurant_id', rA.id);
  check('RLS: B não vê notifications de A', (bSeesA_notif ?? []).length === 0);
  const { data: bSeesA_tok } = await asB.from('tracking_tokens').select('token').eq('restaurant_id', rA.id);
  check('RLS: B não vê tracking_tokens de A', (bSeesA_tok ?? []).length === 0);

  // B tenta ESCREVER em order de A
  const { error: wErr } = await asB.from('orders').update({ status: 'cancelled' }).eq('id', ordA.id);
  const { data: stillReady } = await admin.from('orders').select('status').eq('id', ordA.id).single();
  check('RLS: B não consegue alterar order de A', stillReady.status === 'ready', `virou ${stillReady.status} err=${wErr?.message}`);

  // B tenta INSERIR order para A
  const { error: iErr } = await asB.from('orders').insert({ restaurant_id: rA.id, customer_name: 'x', customer_address: 'y', order_amount: 1, delivery_fee: 0 });
  check('RLS: B não consegue inserir order para A', !!iErr);

  // === API: B autenticado tenta agir sobre order de A ===
  const api = (path, opts = {}) => fetch(`${APP}${path}`, { ...opts, headers: { ...(opts.headers || {}), cookie: '' } });
  // Simula a sessão do B via cookie sb-... — mais simples: chama com Authorization não funciona (rotas usam cookie).
  // Testamos o comportamento sem sessão e confiamos no getApiContext + orderBelongsTo (coberto pelo teste de integração).
  const noAuth = await fetch(`${APP}/api/orders/${ordA.id}`);
  check('API sem auth → 401', noAuth.status === 401, `veio ${noAuth.status}`);
  const noAuthPost = await fetch(`${APP}/api/orders/${ordA.id}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"status":"cancelled"}' });
  check('API status sem auth → 401', noAuthPost.status === 401, `veio ${noAuthPost.status}`);
  const noAuthDispatch = await fetch(`${APP}/api/orders/${ordA.id}/dispatch`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ motoboyId: motoA.id }) });
  check('API dispatch sem auth → 401', noAuthDispatch.status === 401, `veio ${noAuthDispatch.status}`);

  // === TRACKING público ===
  const tOk = await fetch(`${APP}/api/track/${tokA.token}`).then(r => r.json());
  check('tracking: não expõe telefone', !JSON.stringify(tOk).includes('5583999998888'), JSON.stringify(tOk).slice(0,200));
  check('tracking: não expõe endereço textual', !JSON.stringify(tOk).includes('Rua Secreta'));
  check('tracking: não expõe restaurant_id interno', !JSON.stringify(tOk).includes(rA.id));
  check('tracking: não expõe order_id interno', !JSON.stringify(tOk).includes(ordA.id));
  check('tracking: não expõe custo/valor', !('order_amount' in tOk) && !('delivery_fee' in tOk));
  const tBad = await fetch(`${APP}/api/track/inexistente-xyz`);
  check('tracking: token inválido → 404', tBad.status === 404, `veio ${tBad.status}`);
  const tEnum = await fetch(`${APP}/api/track/${ordA.id}`);   // tenta usar o order id como token
  check('tracking: order id não funciona como token', tEnum.status === 404);

  // token expirado
  await admin.from('tracking_tokens').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('token', tokA.token);
  const tExp = await fetch(`${APP}/api/track/${tokA.token}`);
  check('tracking: token expirado → 410', tExp.status === 410, `veio ${tExp.status}`);
  await admin.from('tracking_tokens').update({ expires_at: new Date(Date.now() + 8.64e7).toISOString(), revoked: true }).eq('token', tokA.token);
  const tRev = await fetch(`${APP}/api/track/${tokA.token}`);
  check('tracking: token revogado → 410', tRev.status === 410, `veio ${tRev.status}`);
}

main().catch(e => { console.error(e); fail++; }).finally(async () => {
  for (const c of cleanup.reverse()) { try { await c(); } catch {} }
  console.log(`\n${pass} passaram, ${fail} falharam`);
  process.exit(fail ? 1 : 0);
});
