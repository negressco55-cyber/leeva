/**
 * MOTOBOYS — cadastro self-service, aprovação centralizada e termos de uso.
 * Fase 5 (Bloco A).
 *
 * O restaurante não cadastra mais motoboy. Todo mundo entra por aqui, vira
 * rede Leeva (fleet='leeva'), nasce 'pending_approval', e só a plataforma
 * (admin) aprova. Antes de ficar online a 1ª vez, aceita os termos.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { sendDriverApprovedEmail, sendDriverRejectedEmail } from './mailer';

type DB = SupabaseClient<Database>;
export type ApprovalStatus = Database['public']['Enums']['driver_approval_status'];

// ---------------------------------------------------------------------------
// CPF — validação de formato + dígito verificador (não consulta a Receita)
// ---------------------------------------------------------------------------
export function cleanCpf(v: string): string {
  return (v ?? '').replace(/\D/g, '');
}
export function isValidCpf(v: string): boolean {
  const c = cleanCpf(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (base: string, factorStart: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factorStart - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(c.slice(0, 9), 10) === Number(c[9]) && dv(c.slice(0, 10), 11) === Number(c[10]);
}

// ---------------------------------------------------------------------------
// TERMOS DE USO
// ---------------------------------------------------------------------------
export async function getActiveTerms(
  db: DB,
  audience: 'motoboy' | 'restaurant' = 'motoboy',
): Promise<{ version: number; content: string } | null> {
  const { data } = await db
    .from('terms_versions')
    .select('version, content')
    .eq('active', true)
    .eq('audience', audience)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { version: data.version, content: data.content } : null;
}

/** true se o motoboy ainda precisa aceitar (nunca aceitou ou versão nova saiu). */
export function needsTermsAcceptance(termsAcceptedVersion: number | null, activeVersion: number): boolean {
  return termsAcceptedVersion == null || termsAcceptedVersion < activeVersion;
}

export async function acceptTerms(
  db: DB,
  motoboyId: string,
  version: number,
  ip?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const { error: aErr } = await db
    .from('driver_terms_acceptance')
    .upsert({ motoboy_id: motoboyId, terms_version: version, ip: ip ?? null }, { onConflict: 'motoboy_id,terms_version' });
  if (aErr) return { ok: false, error: 'não foi possível registrar o aceite' };
  await db.from('motoboys').update({ terms_accepted_version: version }).eq('id', motoboyId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// GATE — pode ficar online / receber ofertas?
// ---------------------------------------------------------------------------
export type DriverGate =
  | { ok: true }
  | { ok: false; reason: 'pending_approval' | 'rejected' | 'blocked' | 'terms'; message: string; termsVersion?: number };

export async function checkDriverGate(db: DB, motoboyId: string): Promise<DriverGate> {
  const { data: m } = await db
    .from('motoboys')
    .select('approval_status, approval_reason, blocked, blocked_reason, terms_accepted_version')
    .eq('id', motoboyId)
    .maybeSingle();
  if (!m) return { ok: false, reason: 'rejected', message: 'cadastro não encontrado' };
  if (m.blocked) return { ok: false, reason: 'blocked', message: m.blocked_reason || 'conta pausada — fale com o suporte' };
  if (m.approval_status === 'pending_approval')
    return { ok: false, reason: 'pending_approval', message: 'Seu cadastro está em análise. Avisamos assim que aprovarmos.' };
  if (m.approval_status === 'rejected')
    return { ok: false, reason: 'rejected', message: m.approval_reason || 'Cadastro não aprovado.' };

  const terms = await getActiveTerms(db);
  if (terms && needsTermsAcceptance(m.terms_accepted_version, terms.version))
    return { ok: false, reason: 'terms', message: 'Aceite os termos de uso para continuar.', termsVersion: terms.version };

  return { ok: true };
}

// ---------------------------------------------------------------------------
// CADASTRO SELF-SERVICE (a criação do auth user + upload é na server action)
// ---------------------------------------------------------------------------
export type SelfServiceDriverInput = {
  userId: string;
  fullName: string;
  phone: string;
  cpf: string;
  city: string;
  /** Cadastra depois, na Carteira — não é mais pedido no cadastro inicial. */
  pixKey?: string;
  pixKeyType?: string;
};

export async function createSelfServiceDriver(
  db: DB,
  input: SelfServiceDriverInput,
): Promise<{ ok: true; motoboyId: string } | { ok: false; error: string }> {
  const cpf = cleanCpf(input.cpf);
  if (!isValidCpf(cpf)) return { ok: false, error: 'CPF inválido' };

  // duplicidade
  const { data: dupCpf } = await db.from('motoboys').select('id').eq('cpf', cpf).maybeSingle();
  if (dupCpf) return { ok: false, error: 'Já existe um cadastro com esse CPF.' };
  const { data: dupPhone } = await db
    .from('motoboys')
    .select('id')
    .eq('phone', input.phone)
    .eq('signup_source', 'self_service')
    .maybeSingle();
  if (dupPhone) return { ok: false, error: 'Já existe um cadastro com esse telefone.' };

  const { data, error } = await db
    .from('motoboys')
    .insert({
      restaurant_id: null,
      fleet: 'leeva',
      signup_source: 'self_service',
      approval_status: 'pending_approval',
      status: 'offline',
      user_id: input.userId,
      full_name: input.fullName.slice(0, 200),
      phone: input.phone.slice(0, 40),
      cpf,
      city: input.city.slice(0, 120),
      pix_key: input.pixKey ? input.pixKey.slice(0, 140) : null,
      pix_key_type: input.pixKeyType ?? null,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: 'não foi possível criar o cadastro' };
  return { ok: true, motoboyId: data.id };
}

export async function setDriverDocPaths(
  db: DB,
  motoboyId: string,
  personal?: string,
  vehicle?: string,
  personalBack?: string,
) {
  const patch: Database['public']['Tables']['motoboys']['Update'] = {};
  if (personal) patch.personal_doc_path = personal;
  if (personalBack) patch.personal_doc_back_path = personalBack;
  if (vehicle) patch.vehicle_doc_path = vehicle;
  if (Object.keys(patch).length) await db.from('motoboys').update(patch).eq('id', motoboyId);
}

// ---------------------------------------------------------------------------
// DOCUMENTOS (já aprovado) — reenvio/atualização pelo próprio app, fora do
// cadastro inicial. Mesmo bucket/pastas do self-service (driver-documents/
// {motoboyId}/{tipo}.ext), upsert (substitui o anterior).
// ---------------------------------------------------------------------------
export type DriverDocType = 'personal' | 'personal_back' | 'vehicle' | 'avatar';

const DOC_COLUMN: Record<DriverDocType, keyof Database['public']['Tables']['motoboys']['Update']> = {
  personal: 'personal_doc_path',
  personal_back: 'personal_doc_back_path',
  vehicle: 'vehicle_doc_path',
  avatar: 'avatar_url',
};

export async function saveDriverDocument(
  db: DB,
  motoboyId: string,
  type: DriverDocType,
  bytes: Uint8Array,
  contentType: string,
  ext: string,
): Promise<{ ok: true; requiresReview: boolean } | { ok: false; error: string }> {
  const path = `${motoboyId}/${type}.${ext}`;
  const up = await db.storage.from('driver-documents').upload(path, bytes, { contentType, upsert: true });
  if (up.error) return { ok: false, error: up.error.message };
  const patch: Database['public']['Tables']['motoboys']['Update'] = { [DOC_COLUMN[type]]: path };

  // Documento (CNH/RG, CRLV ou selfie) reenviado depois de já aprovado
  // precisa passar por revisão de novo — sem isso, dava pra trocar o
  // documento sem ninguém do Leeva checar. Volta pra mesma fila de
  // aprovação do admin (getPendingDrivers) — motoboy fica sem receber
  // ofertas até ser reaprovado (autodispatch já exige approval_status
  // 'approved').
  const { data: current } = await db.from('motoboys').select('approval_status').eq('id', motoboyId).maybeSingle();
  let requiresReview = false;
  if (current?.approval_status === 'approved') {
    patch.approval_status = 'pending_approval';
    patch.approval_reason = 'Documento reenviado — aguardando revisão';
    patch.approved_at = null;
    requiresReview = true;
  }

  await db.from('motoboys').update(patch).eq('id', motoboyId);
  return { ok: true, requiresReview };
}

export type DriverDocsStatus = {
  personalDocUrl: string | null;
  personalDocBackUrl: string | null;
  vehicleDocUrl: string | null;
  avatarUrl: string | null;
};

export async function getDriverDocsStatus(db: DB, motoboyId: string): Promise<DriverDocsStatus> {
  const { data: m } = await db
    .from('motoboys')
    .select('personal_doc_path, personal_doc_back_path, vehicle_doc_path, avatar_url')
    .eq('id', motoboyId)
    .maybeSingle();
  return {
    personalDocUrl: await signDoc(db, m?.personal_doc_path ?? null),
    personalDocBackUrl: await signDoc(db, m?.personal_doc_back_path ?? null),
    vehicleDocUrl: await signDoc(db, m?.vehicle_doc_path ?? null),
    avatarUrl: await signDoc(db, m?.avatar_url ?? null),
  };
}

// ---------------------------------------------------------------------------
// FILA DE APROVAÇÃO (admin)
// ---------------------------------------------------------------------------
export type PendingDriver = {
  id: string;
  fullName: string;
  phone: string;
  cpf: string | null;
  city: string | null;
  pixKey: string | null;
  pixKeyType: string | null;
  createdAt: string;
  personalDocUrl: string | null;
  personalDocBackUrl: string | null;
  vehicleDocUrl: string | null;
  avatarUrl: string | null;
};

export async function signDoc(db: DB, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from('driver-documents').createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

export async function getPendingDrivers(db: DB): Promise<PendingDriver[]> {
  const { data } = await db
    .from('motoboys')
    .select(
      'id, full_name, phone, cpf, city, pix_key, pix_key_type, created_at, personal_doc_path, personal_doc_back_path, vehicle_doc_path, avatar_url',
    )
    .eq('approval_status', 'pending_approval')
    .order('created_at', { ascending: true })
    .limit(200);
  const rows = data ?? [];
  return Promise.all(
    rows.map(async (m) => ({
      id: m.id,
      fullName: m.full_name,
      phone: m.phone,
      cpf: m.cpf,
      city: m.city,
      pixKey: m.pix_key,
      pixKeyType: m.pix_key_type,
      createdAt: m.created_at,
      personalDocUrl: await signDoc(db, m.personal_doc_path),
      personalDocBackUrl: await signDoc(db, m.personal_doc_back_path),
      vehicleDocUrl: await signDoc(db, m.vehicle_doc_path),
      avatarUrl: await signDoc(db, m.avatar_url),
    })),
  );
}

/** Busca o e-mail do usuário (fica no Auth, não na tabela motoboys). */
async function driverEmail(db: DB, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await db.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function approveDriver(db: DB, motoboyId: string, adminId: string) {
  const { data } = await db
    .from('motoboys')
    .update({ approval_status: 'approved', approved_by: adminId, approved_at: new Date().toISOString(), approval_reason: null })
    .eq('id', motoboyId)
    .eq('approval_status', 'pending_approval')
    .select('id, user_id, full_name');
  const row = data?.[0];
  if (row) {
    const email = await driverEmail(db, row.user_id);
    if (email) await sendDriverApprovedEmail(email, row.full_name).catch(() => {});
  }
  return { ok: !!data?.length };
}

export async function rejectDriver(db: DB, motoboyId: string, adminId: string, reason: string) {
  const { data } = await db
    .from('motoboys')
    .update({
      approval_status: 'rejected',
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      approval_reason: reason.slice(0, 500),
      status: 'offline',
    })
    .eq('id', motoboyId)
    .in('approval_status', ['pending_approval', 'approved'])
    .select('id, user_id, full_name');
  const row = data?.[0];
  if (row) {
    const email = await driverEmail(db, row.user_id);
    if (email) await sendDriverRejectedEmail(email, row.full_name, reason).catch(() => {});
  }
  return { ok: !!data?.length };
}
