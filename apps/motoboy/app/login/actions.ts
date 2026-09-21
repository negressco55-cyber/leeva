'use server';

import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@leeva/shared';
import { createLeevaServerClient, createLeevaAdminClient } from '@leeva/shared/server';
import { sendPasswordResetEmail } from '@leeva/shared/services';

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!isSupabaseConfigured()) {
    return { error: 'Banco de dados ainda não configurado (veja as instruções na tela inicial).' };
  }
  if (!email || !password) return { error: 'Informe e-mail e senha.' };

  const supabase = await createLeevaServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'E-mail ou senha inválidos.' };

  redirect('/status');
}

export async function logout() {
  const supabase = await createLeevaServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export type ForgotPasswordState = { ok?: boolean; error?: string };

/** Link de redefinição gerado pelo Supabase Admin e enviado pelo Resend. */
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Informe seu e-mail.' };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';
  try {
    const admin = createLeevaAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${base}/redefinir-senha` },
    });
    // não revela se o e-mail existe
    if (error || !data?.properties?.action_link) return { ok: true };
    const sent = await sendPasswordResetEmail(email, data.properties.action_link);
    if (!sent) return { error: 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.' };
  } catch {
    return { ok: true };
  }
  return { ok: true };
}
