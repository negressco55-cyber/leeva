'use server';

import { createLeevaServerClient, createLeevaAdminClient } from '@leeva/shared/server';
import { sendVerificationEmail } from '@leeva/shared/services';

export type ResendState = { ok: boolean; error?: string };

/** Reenvia o link de confirmação de e-mail pro usuário logado (não confirmado ainda). */
export async function resendVerificationEmail(): Promise<ResendState> {
  const supabase = await createLeevaServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: 'sessão inválida' };
  if (user.email_confirmed_at) return { ok: true };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const admin = createLeevaAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
    options: { redirectTo: base },
  });
  if (error || !data?.properties?.action_link) {
    return { ok: false, error: 'não foi possível gerar o link agora' };
  }
  const sent = await sendVerificationEmail(user.email, data.properties.action_link);
  if (!sent) return { ok: false, error: 'não foi possível enviar o e-mail agora' };
  return { ok: true };
}
