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

  const { data: m } = await supabase
    .from('motoboys')
    .select('id, restaurant_id, fleet, full_name, status, active')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!m || !m.active) return null;

  return {
    userId: user.id,
    motoboyId: m.id,
    restaurantId: m.restaurant_id,
    fleet: (m.fleet ?? 'own') as 'own' | 'leeva',
    fullName: m.full_name,
    status: m.status,
  };
}

export function adminDb() {
  return createLeevaAdminClient();
}
