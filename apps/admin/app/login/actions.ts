'use server';

import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@leeva/shared';
import { createLeevaServerClient, createLeevaAdminClient } from '@leeva/shared/server';
import { sendPasswordResetEmail } from '@leeva/shared/services';

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

/**
 * Manda o link de redefinição de senha — gerado pelo Supabase Admin API e
 * enviado pelo Resend direto (não usa o SMTP do Supabase). A senha nova é
 * digitada pelo usuário em /redefinir-senha, nunca passa por aqui.
 */
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Informe seu e-mail.' };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  try {
    const admin = createLeevaAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${base}/redefinir-senha` },
    });
    if (error || !data?.properties?.action_link) return { ok: true };
    const sent = await sendPasswordResetEmail(email, data.properties.action_link);
    if (!sent) return { error: 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.' };
  } catch {
    return { ok: true };
  }
  return { ok: true };
}
