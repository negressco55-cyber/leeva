/**
 * Limpeza pós-sessão noturna: remove dados de teste criados durante a noite,
 * preservando os dados de demonstração permanentes (restaurante demo, frota
 * demo, crédito inicial de demonstração).
 *
 * Uso: node --import tsx --env-file=apps/restaurante/.env.local scripts/cleanup-night.mjs [--dry]
 */
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const DRY = process.argv.includes('--dry');

const DEMO_RESTAURANT = '92a54ae7-6ab1-442d-94c5-42aac96a3d47';

async function main() {
  // 1. fixtures com prefixo de teste em restaurantes/motoboys/pedidos
  const TAG = /\[(F\d|F5C|TRK|ITEST|F4)\]/;

  const { data: rests } = await db.from('restaurants').select('id, name');
  const testRests = (rests ?? []).filter((r) => TAG.test(r.name));
  console.log(`restaurantes de teste: ${testRests.length}`);
  for (const r of testRests) {
    console.log(`  - ${r.name}`);
    if (!DRY) {
      await db.from('credit_ledger').delete().eq('restaurant_id', r.id);
      await db.from('restaurant_credits').delete().eq('restaurant_id', r.id);
      await db.from('payout_policies').delete().eq('restaurant_id', r.id);
      await db.from('restaurants').delete().eq('id', r.id);
    }
  }

  const { data: motos } = await db.from('motoboys').select('id, full_name, phone');
  const testMotos = (motos ?? []).filter(
    (m) => TAG.test(m.full_name ?? '') || /^(f\d|f5c|trk)/i.test(m.phone ?? ''),
  );
  console.log(`motoboys de teste: ${testMotos.length}`);
  for (const m of testMotos) {
    console.log(`  - ${m.full_name} (${m.phone})`);
    if (!DRY) await db.from('motoboys').delete().eq('id', m.id);
  }

  // 2. pedidos órfãos no restaurante demo que NÃO vieram do seed-demo
  //    (seed-demo cria pedidos com customer_name específico; qualquer
  //     "Cliente Créditos"/"Cliente ..." de teste manual sai)
  const { data: orders } = await db
    .from('orders')
    .select('id, customer_name, status, created_at, notes')
    .eq('restaurant_id', DEMO_RESTAURANT);
  const junk = (orders ?? []).filter(
    (o) =>
      TAG.test(o.notes ?? '') ||
      /^Cliente (Créditos|Teste|Demo Teste)/i.test(o.customer_name ?? ''),
  );
  console.log(`pedidos de teste no restaurante demo: ${junk.length}`);
  for (const o of junk) {
    console.log(`  - ${o.customer_name} [${o.status}] ${o.created_at}`);
    if (!DRY) {
      await db.from('tracking_tokens').delete().eq('order_id', o.id);
      await db.from('order_events').delete().eq('order_id', o.id);
      await db.from('credit_ledger').delete().eq('order_id', o.id);
      await db.from('driver_earnings').delete().eq('order_id', o.id);
      await db.from('order_items').delete().eq('order_id', o.id);
      await db.from('orders').delete().eq('id', o.id);
    }
  }

  // 3. tokens de rastreamento órfãos (sem pedido)
  const { data: toks } = await db.from('tracking_tokens').select('id, order_id');
  let orphanToks = 0;
  for (const tk of toks ?? []) {
    const { count } = await db.from('orders').select('id', { count: 'exact', head: true }).eq('id', tk.order_id);
    if (!count) {
      orphanToks++;
      if (!DRY) await db.from('tracking_tokens').delete().eq('id', tk.id);
    }
  }
  console.log(`tokens de rastreamento órfãos: ${orphanToks}`);

  // 4. assinaturas de push de teste
  const { count: pushCount } = await db.from('push_subscriptions').select('id', { count: 'exact', head: true });
  console.log(`push_subscriptions: ${pushCount ?? 0}`);
  if (!DRY && (pushCount ?? 0) > 0) {
    // nenhum device real ainda — qualquer coisa aqui é teste
    const { data: allSubs } = await db.from('push_subscriptions').select('id, endpoint');
    for (const s of allSubs ?? []) {
      if (/fake|f5-|test/i.test(s.endpoint)) await db.from('push_subscriptions').delete().eq('id', s.id);
    }
  }

  console.log(DRY ? '\n(dry-run — nada apagado)' : '\nlimpeza concluída');
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
