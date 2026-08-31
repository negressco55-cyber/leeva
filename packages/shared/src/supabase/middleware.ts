import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '../types/database';
import { authCookieName } from './config';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Mantém a sessão do Supabase válida a cada request e (opcionalmente)
 * protege rotas. Chamado pelo middleware.ts de cada app.
 *
 * @param request        request do Next
 * @param protectedPaths  prefixos que exigem login (redireciona para /login)
 * @param loginPath       rota de login do app
 */
export async function updateLeevaSession(
  request: NextRequest,
  options: { protectedPaths: string[]; loginPath: string },
) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient<Database>(url, anonKey, {
    cookieOptions: { name: authCookieName() },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const needsAuth = options.protectedPaths.some((p) => pathname.startsWith(p));

  if (needsAuth && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = options.loginPath;
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
