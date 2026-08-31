/**
 * Helpers de configuração — seguros em qualquer ambiente (só leem env vars).
 */

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * Nome do cookie de sessão. Cada app usa um nome diferente para que
 * o painel do restaurante e o app do motoboy possam ficar logados ao
 * mesmo tempo no mesmo `localhost` (os cookies são por host, não por porta).
 * Em produção, cada app fica no seu próprio domínio e isso deixa de importar.
 */
export function authCookieName(): string {
  return process.env.NEXT_PUBLIC_LEEVA_AUTH_COOKIE || 'sb-leeva';
}
