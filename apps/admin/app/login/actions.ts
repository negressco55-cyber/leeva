'use server';

import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@leeva/shared';
import { createLeevaServerClient, createLeevaAdminClient } from '@leeva/shared/server';

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!isSupabaseConfigured()) return { error: 'Banco de dados não configurado.' };
  if (!email || !password) return { error: 'Informe e-mail e senha.' };

  const supabase = await createLeevaServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: 'E-mail ou senha inválidos.' };

  const { data: admin } = await createLeevaAdminClient()
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', data.user.id)
    .eq('active', true)
    .maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return { error: 'Esta conta não tem acesso ao painel da plataforma.' };
  }

  redirect('/visao-geral');
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
    redirectTo: `${base}/auth/callback?next=/redefinir-senha`,
  });
  return { ok: true };
}
