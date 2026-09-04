/**
 * Teste manual do fluxo iFood (sandbox): autentica, descobre o(s)
 * merchant(s), busca eventos pendentes e, se houver um pedido novo (evento
 * PLC), importa de verdade no restaurante demo — passando pela mesma
 * validação de endereço dos outros canais.
 *
 * Uso: node --import tsx --env-file=apps/restaurante/.env.local scripts/test-ifood-sandbox.mjs
 */
import { createClient } from '@supabase/supabase-js';
import {
  getIfoodAccessToken,
  listIfoodMerchants,
  pollIfoodEvents,
} from '../packages/shared/src/integrations/ifood-client.ts';
import { syncIfoodOrders } from '../packages/shared/src/services/ifood-sync.ts';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log('1) Autenticando (OAuth client_credentials)…');
  let token;
  try {
    token = await getIfoodAccessToken({ force: true });
    console.log(`   ✅ token obtido (${token.slice(0, 8)}…, ${token.length} chars)`);
  } catch (e) {
    console.log(`   ❌ falhou: ${e.message}`);
    if (e.body) console.log('   detalhe:', JSON.stringify(e.body).slice(0, 500));
    process.exit(1);
  }

  console.log('\n2) Listando merchants associados ao app…');
  let merchants = [];
  try {
    merchants = await listIfoodMerchants(token);
    console.log(`   ✅ ${merchants.length} merchant(s):`);
    for (const m of merchants) console.log(`      - ${m.id}  ${m.name ?? m.corporateName ?? ''}`);
  } catch (e) {
    console.log(`   ⚠️  falhou: ${e.message} — seguindo sem filtrar por merchant`);
  }

  console.log('\n3) Buscando eventos pendentes (GET /events:polling)…');
  let events = [];
  try {
    events = await pollIfoodEvents(token, merchants.map((m) => m.id));
    console.log(`   ✅ ${events.length} evento(s) pendente(s)`);
    for (const e of events) console.log(`      - ${e.code} (${e.fullCode ?? ''}) pedido=${e.orderId ?? '—'} id=${e.id}`);
  } catch (e) {
    console.log(`   ❌ falhou: ${e.message}`);
    process.exit(1);
  }

  if (!events.length) {
    console.log(
      '\n   Nenhum evento parado. Isso é normal se ainda não existe um pedido de\n' +
      '   teste no sandbox — o polling só devolve algo depois que VOCÊ simular\n' +
      '   um pedido pelo portal de testes do iFood (não é algo que eu consigo\n' +
      '   disparar por aqui). Auth + merchants + polling estão funcionando.\n',
    );
    process.exit(0);
  }

  console.log('\n4) Há evento(s) — rodando o fluxo completo contra o restaurante demo…');
  const { data: rest } = await db
    .from('restaurants')
    .select('id, name')
    .eq('onboarding_completed', true)
    .not('latitude', 'is', null)
    .limit(1)
    .single();
  console.log(`   restaurante: ${rest?.name} (${rest?.id})`);

  const result = await syncIfoodOrders(db, rest.id);
  console.log('   resultado:', JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
