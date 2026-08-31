'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/database';
import { authCookieName } from './config';

/**
 * Cliente Supabase para uso no NAVEGADOR (Client Components).
 * Usa apenas a chave pública (anon). A segurança real vem do RLS.
 */
export function createLeevaBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local',
    );
  }

  return createBrowserClient<Database>(url, anonKey, {
    cookieOptions: { name: authCookieName() },
  });
}
