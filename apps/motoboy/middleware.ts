import type { NextRequest } from 'next/server';
import { updateLeevaSession } from '@leeva/shared/middleware';

export async function middleware(request: NextRequest) {
  return updateLeevaSession(request, {
    protectedPaths: ['/status', '/entrega', '/historico', '/desempenho', '/realtime-test'],
    loginPath: '/login',
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
