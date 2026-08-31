'use server';

import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@leeva/shared';
import { createLeevaServerClient } from '@leeva/shared/server';

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const redirectTo = String(formData.get('redirectTo') ?? '/dashboard') || '/dashboard';

  if (!isSupabaseConfigured()) {
    return { error: 'Banco de dados ainda não configurado (veja as instruções na página inicial).' };
  }
  if (!email || !password) return { error: 'Informe e-mail e senha.' };

  const supabase = await createLeevaServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'E-mail ou senha inválidos.' };

  redirect(redirectTo);
}

export async function logout() {
  const supabase = await createLeevaServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
