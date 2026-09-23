'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createLeevaAdminClient, createLeevaServerClient } from '@leeva/shared/server';
import { isSupabaseAdminConfigured, onlyDigits } from '@leeva/shared';
import { createSelfServiceDriver, sendNewDriverSignupEmail, acceptTerms } from '@leeva/shared/services';

export type SignupState = { error?: string };

/**
 * Cadastro RÁPIDO — só nome, e-mail, telefone e senha. CPF, cidade,
 * documentos e selfie ficam pro checklist "Meus dados" logo depois (ver
 * app/(app)/documentos), um item de cada vez. Um formulário grande com 4
 * fotos de uma vez só é frágil em internet ruim — foi o que dava "erro ao
 * enviar" antes.
 */
export async function submitSignup(_prev: SignupState, form: FormData): Promise<SignupState> {
  if (!isSupabaseAdminConfigured()) return { error: 'Sistema em configuração — tente mais tarde.' };

  const fullName = String(form.get('fullName') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const phone = onlyDigits(String(form.get('phone') ?? ''));
  const termsVersionRaw = form.get('termsVersion');
  const termsVersion = termsVersionRaw ? Number(termsVersionRaw) : null;

  if (fullName.length < 3) return { error: 'Informe seu nome completo.' };
  if (!email.includes('@')) return { error: 'E-mail inválido.' };
  if (password.length < 6) return { error: 'A senha precisa ter ao menos 6 caracteres.' };
  if (phone.length < 10) return { error: 'Telefone inválido (com DDD).' };

  const admin = createLeevaAdminClient();

  // 1. cria o usuário no Auth
  const { data: created, error: uErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'motoboy', full_name: fullName, phone },
  });
  if (uErr || !created.user) {
    if (uErr?.message?.match(/already/i)) return { error: 'Já existe uma conta com esse e-mail.' };
    return { error: 'Não foi possível criar a conta. Tente outro e-mail.' };
  }
  const userId = created.user.id;

  // 2. cria o cadastro do motoboy (pending_approval) — sem CPF/cidade ainda
  const res = await createSelfServiceDriver(admin, { userId, fullName, phone });
  if (!res.ok) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { error: res.error };
  }

  // 3. aceite dos termos de uso, já no cadastro
  if (termsVersion != null) {
    const ip = await currentIp();
    await acceptTerms(admin, res.motoboyId, termsVersion, ip).catch(() => {});
  }

  // 4. avisa o operador (best-effort — não bloqueia o cadastro)
  if (process.env.OPS_ALERT_EMAIL) {
    await sendNewDriverSignupEmail(process.env.OPS_ALERT_EMAIL, fullName, '—').catch(() => {});
  }

  // 5. login — a partir daqui o motoboy completa CPF/documentos no checklist
  const supabase = await createLeevaServerClient();
  const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
  if (sErr) redirect('/login');
  redirect('/status');
}

export async function currentIp(): Promise<string | null> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
}
