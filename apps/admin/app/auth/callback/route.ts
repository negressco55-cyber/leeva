import { NextResponse, type NextRequest } from 'next/server';
import { createLeevaServerClient } from '@leeva/shared/server';

/** Troca o `code` do Supabase Auth por uma sessão (usado no link de redefinição de senha). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/visao-geral';

  if (code) {
    const supabase = await createLeevaServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
