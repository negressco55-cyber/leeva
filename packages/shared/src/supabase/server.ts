import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '../types/database';
import { authCookieName } from './config';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Cliente Supabase para uso no SERVIDOR (Server Components, Route Handlers,
 * Server Actions). Lê/grava a sessão nos cookies da request.
 */
export async function createLeevaServerClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local',
    );
  }

  return createServerClient<Database>(url, anonKey, {
    cookieOptions: { name: authCookieName() },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Chamado a partir de um Server Component — pode ser ignorado
          // quando existe um middleware atualizando a sessão.
        }
      },
    },
  });
}

/**
 * Cliente ADMIN (service_role) — ignora o RLS. Use SOMENTE no servidor,
 * em fluxos controlados (ex: criar restaurante + primeiro usuário no signup).
 */
export function createLeevaAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local',
    );
  }

  return createServerClient<Database>(url, serviceKey, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
