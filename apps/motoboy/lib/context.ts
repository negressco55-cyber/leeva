import { redirect } from 'next/navigation';
import { createLeevaServerClient, createLeevaAdminClient } from '@leeva/shared/server';

export type MotoboyContext = {
  userId: string;
  motoboyId: string;
  /** null para entregadores da rede Leeva (não pertencem a um restaurante). */
  restaurantId: string | null;
  fleet: 'own' | 'leeva';
  fullName: string;
  status: 'offline' | 'available' | 'on_delivery';
  approvalStatus: 'pending_approval' | 'approved' | 'rejected';
  approvalReason: string | null;
  termsAcceptedVersion: number | null;
};

export async function requireMotoboyContext(): Promise<MotoboyContext> {
  const ctx = await getMotoboyContext();
  if (!ctx) redirect('/login');
  return ctx;
}

export async function getMotoboyContext(): Promise<MotoboyContext | null> {
  const supabase = await createLeevaServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return motoboyContextForUser(user.id);
}

/**
 * Igual ao `getMotoboyContext`, mas aceita também `Authorization: Bearer <token>`
 * — usado pelo app nativo (Expo/React Native), que não tem cookies de sessão.
 * Se não houver header Bearer, cai no fluxo por cookie.
 */
export async function getMotoboyContextFromReq(req: Request): Promise<MotoboyContext | null> {
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
  const token = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null;
  if (!token) return getMotoboyContext();

  const admin = createLeevaAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return motoboyContextForUser(data.user.id);
}

async function motoboyContextForUser(userId: string): Promise<MotoboyContext | null> {
  const db = createLeevaAdminClient();
  const { data: m } = await db
    .from('motoboys')
    .select('id, restaurant_id, fleet, full_name, status, active, approval_status, approval_reason, terms_accepted_version')
    .eq('user_id', userId)
    .maybeSingle();
  if (!m || !m.active) return null;

  return {
    userId,
    motoboyId: m.id,
    restaurantId: m.restaurant_id,
    fleet: (m.fleet ?? 'own') as 'own' | 'leeva',
    fullName: m.full_name,
    status: m.status,
    approvalStatus: m.approval_status as 'pending_approval' | 'approved' | 'rejected',
    approvalReason: m.approval_reason as string | null,
    termsAcceptedVersion: m.terms_accepted_version as number | null,
  };
}

export function adminDb() {
  return createLeevaAdminClient();
}
