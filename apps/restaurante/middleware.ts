import type { NextRequest } from 'next/server';
import { updateLeevaSession } from '@leeva/shared/middleware';

export async function middleware(request: NextRequest) {
  return updateLeevaSession(request, {
    protectedPaths: [
      '/dashboard',
      '/pedidos',
      '/mapa',
      '/indicadores',
      '/financeiro',
      '/integracoes',
      '/configuracoes',
      '/equipe',
      '/onboarding',
    ],
    loginPath: '/login',
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
