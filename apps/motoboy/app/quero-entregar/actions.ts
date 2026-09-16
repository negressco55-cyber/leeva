'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createLeevaAdminClient, createLeevaServerClient } from '@leeva/shared/server';
import { isSupabaseAdminConfigured, onlyDigits } from '@leeva/shared';
import { createSelfServiceDriver, setDriverDocPaths, isValidCpf, sendNewDriverSignupEmail } from '@leeva/shared/services';

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

  // cada documento tem dois inputs (foto tirada na hora OU PDF/arquivo da
  // galeria) — usa o que a pessoa preencheu.
  const pick = (base: string): File | null => {
    const photo = form.get(`${base}Photo`) as File | null;
    if (photo && photo.size > 0) return photo;
    const pdf = form.get(`${base}Pdf`) as File | null;
    if (pdf && pdf.size > 0) return pdf;
    return null;
  };
  const personalFront = pick('personalDocFront');
  const personalBack = pick('personalDocBack');
  const vehicleDoc = pick('vehicleDoc');

  if (fullName.length < 3) return { error: 'Informe seu nome completo.' };
  if (!email.includes('@')) return { error: 'E-mail inválido.' };
  if (password.length < 6) return { error: 'A senha precisa ter ao menos 6 caracteres.' };
  if (phone.length < 10) return { error: 'Telefone inválido (com DDD).' };
  if (!isValidCpf(cpf)) return { error: 'CPF inválido.' };
  for (const [label, f] of [
    ['pessoal (frente)', personalFront],
    ['pessoal (verso)', personalBack],
    ['do veículo', vehicleDoc],
  ] as const) {
    if (!f) return { error: `Anexe o documento ${label}.` };
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
    const pPath = await up(personalFront!, 'personal');
    const pBackPath = await up(personalBack!, 'personal_back');
    const vPath = await up(vehicleDoc!, 'vehicle');
    await setDriverDocPaths(admin, res.motoboyId, pPath, vPath, pBackPath);
  } catch {
    // não bloqueia — o admin pode pedir o reenvio; mas registra
    console.error('[signup] upload de documento falhou');
  }

  // 4. avisa o operador (best-effort — não bloqueia o cadastro)
  if (process.env.OPS_ALERT_EMAIL) {
    await sendNewDriverSignupEmail(process.env.OPS_ALERT_EMAIL, fullName, city).catch(() => {});
  }

  // 5. login
  const supabase = await createLeevaServerClient();
  const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
  if (sErr) redirect('/login');
  redirect('/status');
}

export async function currentIp(): Promise<string | null> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
}
