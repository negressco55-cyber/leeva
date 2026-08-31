/**
 * DEMO / DEVELOPMENT ONLY — dados de demonstração da Fase 2.
 *
 * Cria (de forma idempotente): restaurante demo com coordenadas, 5 motoboys,
 * ~10 clientes, ~20 pedidos em vários status e regiões (João Pessoa/PB),
 * algumas entregas concluídas com tempos reais, algumas em andamento.
 *
 * Uso:  node --env-file=apps/restaurante/.env.local scripts/seed-demo.mjs
 *
 * Os pedidos demo levam a observação "[DEMO]" para ficarem distintos de
 * produção.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const RESTAURANT = { lat: -7.1195, lng: -34.8451 };
const REGIONS = [
  { name: 'Manaíra', lat: -7.0952, lng: -34.8372 },
  { name: 'Bessa', lat: -7.0781, lng: -34.8402 },
  { name: 'Tambaú', lat: -7.1083, lng: -34.8331 },
  { name: 'Cabo Branco', lat: -7.1301, lng: -34.7985 },
  { name: 'Bancários', lat: -7.1436, lng: -34.8302 },
];
const NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabi', 'Hugo', 'Igor', 'Júlia', 'Karina', 'Leo'];
const ITEMS = [
  ['Brownie', 8], ['Copo Supremo', 15], ['Pizza Calabresa', 45], ['Esfiha', 6],
  ['Açaí 500ml', 18], ['Hambúrguer Artesanal', 32], ['Refrigerante Lata', 6],
];
const jitter = (v) => v + (Math.random() - 0.5) * 0.012;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const iso = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString();

async function main() {
  // 1. restaurante demo
  const { data: owner } = await db.auth.admin.listUsers({ perPage: 200 });
  const dono = owner.users.find((u) => u.email === 'dono@leeva.dev');
  let restaurantId;
  if (dono) {
    const { data } = await db.from('users').select('restaurant_id').eq('id', dono.id).single();
    restaurantId = data?.restaurant_id;
  }
  if (!restaurantId) {
    const { data } = await db.from('restaurants').insert({ name: 'Restaurante Demo Leeva' }).select('id').single();
    restaurantId = data.id;
  }
  await db.from('restaurants').update({ latitude: RESTAURANT.lat, longitude: RESTAURANT.lng }).eq('id', restaurantId);
  console.log('restaurante:', restaurantId);

  // 2. motoboys (5) — posicionados perto de regiões diferentes
  const { data: existingMotoboys } = await db.from('motoboys').select('id, full_name').eq('restaurant_id', restaurantId);
  const motoboyNames = ['Carlos', 'João', 'Pedro', 'Marcos', 'Rafael'];
  const motoboys = [...(existingMotoboys ?? [])];
  for (let i = 0; i < motoboyNames.length; i++) {
    const name = `${motoboyNames[i]} (demo)`;
    if (motoboys.find((m) => m.full_name === name)) continue;
    const r = REGIONS[i % REGIONS.length];
    const { data } = await db
      .from('motoboys')
      .insert({
        restaurant_id: restaurantId,
        full_name: name,
        phone: `8399000${1000 + i}`,
        status: i < 3 ? 'available' : 'offline',
        current_latitude: jitter(r.lat),
        current_longitude: jitter(r.lng),
        location_updated_at: iso(2),
        max_concurrent_deliveries: 3,
      })
      .select('id, full_name')
      .single();
    if (data) motoboys.push(data);
  }
  const availableMotoboys = motoboys.filter((m) => m.full_name.includes('demo')).slice(0, 3);
  console.log('motoboys:', motoboys.length);

  // 3. já existe seed demo?
  const { count: demoCount } = await db
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .ilike('notes', '%[DEMO]%');
  if ((demoCount ?? 0) >= 15) {
    console.log(`já existem ${demoCount} pedidos demo — nada a fazer.`);
    return;
  }

  // 4. clientes + pedidos
  const plan = [
    // status, minutos-atrás, motoboy?
    ['waiting_dispatch', 4], ['waiting_dispatch', 9], ['waiting_dispatch', 14],
    ['preparing', 18], ['preparing', 22], ['ready', 27], ['ready', 31],
    ['assigned', 20, 0], ['assigned', 12, 1],
    ['picked_up', 35, 0], ['in_route', 40, 1], ['in_route', 25, 2],
    ['delivered', 70, 0], ['delivered', 95, 1], ['delivered', 120, 2],
    ['delivered', 150, 0], ['delivered', 180, 1], ['delivered', 55, 2],
    ['cancelled', 200], ['delivered', 240, 0],
  ];

  for (let i = 0; i < plan.length; i++) {
    const [status, minAgo, mi] = plan[i];
    const region = REGIONS[i % REGIONS.length];
    const custName = `${pick(NAMES)} ${pick(['Silva', 'Souza', 'Lima', 'Costa', 'Alves'])}`;
    const phone = `8398${String(100000 + i).slice(-6)}`;

    const { data: cust } = await db
      .from('customers')
      .insert({
        restaurant_id: restaurantId,
        name: custName,
        phone,
        address: `Rua ${pick(['das Flores', 'do Sol', 'Central', 'da Praia'])}, ${100 + i} - ${region.name}`,
        latitude: jitter(region.lat),
        longitude: jitter(region.lng),
        region: region.name,
      })
      .select('id')
      .single();

    const nItems = 1 + (i % 3);
    const items = Array.from({ length: nItems }, () => {
      const [n, p] = pick(ITEMS);
      return { name: n, quantity: 1 + (i % 2), unit_price: p };
    });
    const amount = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    const motoboyId = mi != null ? availableMotoboys[mi]?.id ?? null : null;

    const { data: order } = await db
      .from('orders')
      .insert({
        restaurant_id: restaurantId,
        customer_id: cust?.id,
        motoboy_id: motoboyId,
        source: pick(['manual', 'manual', 'ifood', 'whatsapp', 'menu']),
        customer_name: custName,
        customer_phone: phone,
        customer_address: `Rua ${pick(['das Flores', 'do Sol', 'Central'])}, ${100 + i} - ${region.name}`,
        latitude: jitter(region.lat),
        longitude: jitter(region.lng),
        region: region.name,
        order_amount: amount,
        delivery_fee: 6 + (i % 4) * 2,
        status: 'waiting_dispatch',
        notes: '[DEMO]',
        created_at: iso(minAgo),
      })
      .select('id')
      .single();
    if (!order) continue;

    await db.from('order_items').insert(
      items.map((it) => ({ order_id: order.id, restaurant_id: restaurantId, ...it })),
    );

    // avança até o status desejado (respeita triggers de milestone/eventos)
    const flow = ['preparing', 'ready', 'assigned', 'picked_up', 'in_route', 'delivered'];
    const target = status === 'cancelled' ? ['cancelled'] : flow.slice(0, flow.indexOf(status) + 1);
    for (const st of target) {
      await db.from('orders').update({ status: st }).eq('id', order.id);
    }
    // backdata os milestones para os indicadores fazerem sentido
    if (status === 'delivered') {
      await db
        .from('orders')
        .update({
          preparing_at: iso(minAgo - 3),
          ready_at: iso(minAgo - 12),
          assigned_at: iso(minAgo - 14),
          picked_up_at: iso(minAgo - 20),
          in_route_at: iso(minAgo - 25),
          delivered_at: iso(minAgo - 25 - (15 + (i % 20))),
        })
        .eq('id', order.id);
    }
  }

  // motoboys com entrega ativa -> on_delivery
  for (const m of availableMotoboys) {
    const { count } = await db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('motoboy_id', m.id)
      .in('status', ['assigned', 'picked_up', 'in_route']);
    await db.from('motoboys').update({ status: count ? 'on_delivery' : 'available' }).eq('id', m.id);
  }

  console.log(`\n${plan.length} pedidos demo criados. Login: dono@leeva.dev / leeva123`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
