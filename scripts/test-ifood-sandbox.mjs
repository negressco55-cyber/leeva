/**
 * Teste manual do fluxo iFood (sandbox) — authorization_code + userCode
 * (apps distribuídos, ver docs/INTEGRATIONS.md#ifood).
 *
 * Uso:
 *   node --import tsx --env-file=apps/restaurante/.env.local scripts/test-ifood-sandbox.mjs start
 *     → gera o userCode + link do Portal do Parceiro. Abra o link, autorize
 *       o app com a conta do restaurante de teste no sandbox do iFood.
 *
 *   node --import tsx --env-file=apps/restaurante/.env.local scripts/test-ifood-sandbox.mjs complete
 *     → depois de autorizar, troca o código por access/refresh token e
 *       roda um ciclo de sincronização completo (poll → import, se houver
 *       pedido de teste parado).
 *
 *   node --import tsx --env-file=apps/restaurante/.env.local scripts/test-ifood-sandbox.mjs status
 *     → mostra o estado atual do vínculo.
 */
import { createClient } from '@supabase/supabase-js';
import {
  getIfoodLinkStatus,
  startIfoodLink,
  completeIfoodLink,
  syncIfoodOrders,
} from '../packages/shared/src/services/index.ts';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function demoRestaurant() {
  const { data } = await db
    .from('restaurants')
    .select('id, name')
    .eq('onboarding_completed', true)
    .not('latitude', 'is', null)
    .limit(1)
    .single();
  return data;
}

async function main() {
  const cmd = process.argv[2] ?? 'status';
  const rest = await demoRestaurant();
  if (!rest) {
    console.log('nenhum restaurante demo encontrado (onboarding_completed=true).');
    process.exit(1);
  }
  console.log(`Restaurante: ${rest.name} (${rest.id})\n`);

  if (cmd === 'status') {
    const s = await getIfoodLinkStatus(db, rest.id);
    console.log(JSON.stringify(s, null, 2));
    return;
  }

  if (cmd === 'start') {
    console.log('Gerando userCode (POST /authentication/v1.0/oauth/userCode)…');
    try {
      const s = await startIfoodLink(db, rest.id);
      console.log('✅ código gerado:\n');
      console.log(`   userCode: ${s.userCode}`);
      console.log(`   link:     ${s.verificationUrlComplete || s.verificationUrl}`);
      console.log(`   expira:   ${s.userCodeExpiresAt}`);
      console.log('\nAbra o link acima, logue com a conta do restaurante de teste no');
      console.log('sandbox do iFood, e autorize o app. Depois rode:');
      console.log('  node --import tsx --env-file=apps/restaurante/.env.local scripts/test-ifood-sandbox.mjs complete');
    } catch (e) {
      console.log(`❌ falhou: ${e.message}`);
      if (e.body) console.log('   detalhe:', JSON.stringify(e.body).slice(0, 800));
      process.exit(1);
    }
    return;
  }

  if (cmd === 'complete') {
    console.log('Tentando trocar o userCode por access/refresh token…');
    const s = await completeIfoodLink(db, rest.id);
    console.log(JSON.stringify(s, null, 2));
    if (s.linkStatus === 'pending') {
      console.log('\n⏳ ainda pendente — conclua a autorização no Portal do Parceiro e rode "complete" de novo.');
      return;
    }
    if (s.linkStatus !== 'linked') {
      console.log('\n❌ não vinculou.');
      process.exit(1);
    }
    console.log('\n✅ vinculado! Rodando um ciclo de sincronização (poll → import)…\n');
    const result = await syncIfoodOrders(db, rest.id);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }

  console.log('comando desconhecido — use: start | complete | status');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
