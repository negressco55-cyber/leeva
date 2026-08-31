import { redirect } from 'next/navigation';
import { createLeevaServerClient, createLeevaAdminClient } from '@leeva/shared/server';

export type AdminContext = {
  userId: string;
  email: string | null;
  name: string | null;
};

async function resolveAdmin(): Promise<AdminContext | null> {
  const supabase = await createLeevaServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // valida no BACKEND com service_role — nunca confia em flag do cliente
  const { data: row } = await createLeevaAdminClient()
    .from('platform_admins')
    .select('user_id, email, name, active')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle();
  if (!row) return null;

  return { userId: user.id, email: row.email ?? user.email ?? null, name: row.name ?? null };
}

/** Contexto do painel admin. Redireciona para /login se não for admin. */
export async function requireAdminContext(): Promise<AdminContext> {
  const ctx = await resolveAdmin();
  if (!ctx) redirect('/login');
  return ctx;
}

/** Contexto para rotas de API. Retorna null (a rota decide o status). */
export async function getAdminApiContext(): Promise<AdminContext | null> {
  return resolveAdmin();
}

export function adminDb() {
  return createLeevaAdminClient();
}
