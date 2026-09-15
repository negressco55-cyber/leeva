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

export type ForgotPasswordState = { ok?: boolean; error?: string };

/** Manda o e-mail de redefinição de senha do próprio Supabase — a senha
 *  nova é digitada pelo usuário em /redefinir-senha, nunca passa por aqui. */
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Informe seu e-mail.' };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const supabase = await createLeevaServerClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/redefinir-senha`,
  });
  // sempre "ok", exista ou não a conta — não revela se o e-mail está cadastrado.
  return { ok: true };
}
