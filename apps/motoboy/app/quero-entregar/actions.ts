'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createLeevaAdminClient, createLeevaServerClient } from '@leeva/shared/server';
import { isSupabaseAdminConfigured, onlyDigits } from '@leeva/shared';
import { createSelfServiceDriver, setDriverDocPaths, isValidCpf } from '@leeva/shared/services';

export type SignupState = { error?: string };

const MAX_FILE = 5 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export async function submitSignup(_prev: SignupState, form: FormData): Promise<SignupState> {
  if (!isSupabaseAdminConfigured()) return { error: 'Sistema em configuração — tente mais tarde.' };

  const fullName = String(form.get('fullName') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const phone = onlyDigits(String(form.get('phone') ?? ''));
  const cpf = String(form.get('cpf') ?? '');
  const city = String(form.get('city') ?? 'João Pessoa - PB').trim() || 'João Pessoa - PB';
  const pixKey = String(form.get('pixKey') ?? '').trim();
  const pixKeyType = String(form.get('pixKeyType') ?? 'cpf');
  const personalDoc = form.get('personalDoc') as File | null;
  const vehicleDoc = form.get('vehicleDoc') as File | null;

  if (fullName.length < 3) return { error: 'Informe seu nome completo.' };
  if (!email.includes('@')) return { error: 'E-mail inválido.' };
  if (password.length < 6) return { error: 'A senha precisa ter ao menos 6 caracteres.' };
  if (phone.length < 10) return { error: 'Telefone inválido (com DDD).' };
  if (!isValidCpf(cpf)) return { error: 'CPF inválido.' };
  if (pixKey.length < 5) return { error: 'Informe sua chave Pix.' };
  for (const [label, f] of [['pessoal', personalDoc], ['do veículo', vehicleDoc]] as const) {
    if (!f || f.size === 0) return { error: `Anexe o documento ${label}.` };
    if (f.size > MAX_FILE) return { error: `O documento ${label} passa de 5 MB.` };
    if (!OK_TYPES.includes(f.type)) return { error: `Documento ${label}: use foto (JPG/PNG) ou PDF.` };
  }

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

  // 2. cria o cadastro do motoboy (pending_approval)
  const res = await createSelfServiceDriver(admin, {
    userId,
    fullName,
    phone,
    cpf,
    city,
    pixKey,
    pixKeyType,
  });
  if (!res.ok) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { error: res.error };
  }

  // 3. upload dos documentos
  try {
    const up = async (f: File, name: string) => {
      const path = `${res.motoboyId}/${name}.${EXT[f.type] ?? 'bin'}`;
      await admin.storage.from('driver-documents').upload(path, f, { contentType: f.type, upsert: true });
      return path;
    };
    const pPath = await up(personalDoc!, 'personal');
    const vPath = await up(vehicleDoc!, 'vehicle');
    await setDriverDocPaths(admin, res.motoboyId, pPath, vPath);
  } catch {
    // não bloqueia — o admin pode pedir o reenvio; mas registra
    console.error('[signup] upload de documento falhou');
  }

  // 4. login
  const supabase = await createLeevaServerClient();
  const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
  if (sErr) redirect('/login');
  redirect('/status');
}

export async function currentIp(): Promise<string | null> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
}
