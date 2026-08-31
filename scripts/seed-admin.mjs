/**
 * DEV — cria o operador da plataforma Leeva (acesso ao painel admin, porta 3002).
 *
 * Login: admin@leeva.dev / leeva123
 *
 * Uso: node --import tsx --env-file=apps/restaurante/.env.local scripts/seed-admin.mjs
 */
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMAIL = process.env.ADMIN_EMAIL || 'admin@leeva.dev';
const PASSWORD = process.env.ADMIN_PASSWORD || 'leeva123';

async function main() {
  const existing = (await db.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === EMAIL);
  let userId = existing?.id;
  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log('usuário criado:', EMAIL);
  } else {
    console.log('usuário já existe:', EMAIL);
  }

  const { error } = await db
    .from('platform_admins')
    .upsert({ user_id: userId, email: EMAIL, name: 'Operador Leeva', active: true }, { onConflict: 'user_id' });
  if (error) throw error;

  console.log(`\nOK. Painel admin: http://localhost:3002 — ${EMAIL} / ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
