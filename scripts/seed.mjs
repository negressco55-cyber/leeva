/**
 * Seed de desenvolvimento do Leeva (idempotente — pode rodar de novo sem problema).
 *
 * Cria: 1 restaurante, 1 dono, 1 motoboy (já ativado) e 2 pedidos —
 * o suficiente para testar o realtime entre os dois apps.
 *
 * Uso (na raiz do projeto):
 *   node --env-file=apps/restaurante/.env.local scripts/seed.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const OWNER = { email: 'dono@leeva.dev', password: 'leeva123' };
const MOTOBOY = { email: 'motoboy@leeva.dev', password: 'leeva123', phone: '11999990000' };

async function findAuthUser(email) {
  const { data } = await db.auth.admin.listUsers({ perPage: 200 });
  return data.users.find((u) => u.email === email) ?? null;
}

async function ensureUser(creds, metadata) {
  const existing = await findAuthUser(creds.email);
  if (existing) return existing;
  const { data, error } = await db.auth.admin.createUser({
    email: creds.email,
    password: creds.password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) throw error;
  return data.user;
}

async function main() {
  // restaurante (reaproveita se o dono já existe)
  const existingOwner = await findAuthUser(OWNER.email);
  let restaurantId;

  if (existingOwner) {
    const { data } = await db.from('users').select('restaurant_id').eq('id', existingOwner.id).single();
    restaurantId = data?.restaurant_id;
  }

  if (!restaurantId) {
    const { data, error } = await db
      .from('restaurants')
      .insert({ name: 'Restaurante Demo Leeva', phone: '1133334444' })
      .select('id')
      .single();
    if (error) throw error;
    restaurantId = data.id;
  }
  console.log('restaurante:', restaurantId);

  await ensureUser(OWNER, {
    role: 'restaurant_owner',
    full_name: 'Dona Demo',
    restaurant_id: restaurantId,
  });
  console.log('dono:', OWNER.email, '/', OWNER.password);

  const mUser = await ensureUser(MOTOBOY, {
    role: 'motoboy',
    full_name: 'Motoboy Demo',
    phone: MOTOBOY.phone,
  });
  await db.from('users').update({ restaurant_id: restaurantId }).eq('id', mUser.id);

  // registro em motoboys
  let { data: motoboy } = await db
    .from('motoboys')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('phone', MOTOBOY.phone)
    .maybeSingle();

  if (!motoboy) {
    const { data, error } = await db
      .from('motoboys')
      .insert({
        restaurant_id: restaurantId,
        user_id: mUser.id,
        full_name: 'Motoboy Demo',
        phone: MOTOBOY.phone,
        status: 'available',
      })
      .select('id')
      .single();
    if (error) throw error;
    motoboy = data;
  } else {
    await db.from('motoboys').update({ user_id: mUser.id, status: 'available' }).eq('id', motoboy.id);
  }
  console.log('motoboy:', MOTOBOY.email, '/', MOTOBOY.password);

  // pedidos de exemplo (só se ainda não houver nenhum)
  const { count } = await db
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId);

  if (!count) {
    await db.from('orders').insert([
      {
        restaurant_id: restaurantId,
        customer_name: 'Cliente A',
        customer_address: 'Rua A, 100',
        order_amount: 42.9,
        delivery_fee: 7,
        status: 'waiting_dispatch',
      },
      {
        restaurant_id: restaurantId,
        motoboy_id: motoboy.id,
        customer_name: 'Cliente B',
        customer_address: 'Rua B, 200',
        order_amount: 88.0,
        delivery_fee: 9,
        status: 'assigned',
      },
    ]);
    console.log('pedidos de exemplo criados.');
  } else {
    console.log(`pedidos já existem (${count}), pulando.`);
  }

  console.log('\nSeed concluído. Faça login nos dois apps com as credenciais acima.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
