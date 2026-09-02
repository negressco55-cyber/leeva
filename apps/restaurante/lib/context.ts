import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createLeevaServerClient, createLeevaAdminClient } from '@leeva/shared/server';
import type { UserRole } from '@leeva/shared';

export type RestaurantContext = {
  userId: string;
  email: string | null;
  role: UserRole;
  restaurantId: string;
  restaurantName: string;
  fullName: string | null;
};

/**
 * Contexto autenticado do painel do restaurante. Redireciona se não logado.
 *
 * `cache()` deduplica a chamada dentro de uma mesma request: o layout e a
 * página compartilham o resultado (1 `auth.getUser()` + 1 query, não 2).
 */
export const requireRestaurantContext = cache(async function requireRestaurantContext(): Promise<RestaurantContext> {
  const supabase = await createLeevaServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role, full_name, restaurant_id, restaurants(name)')
    .eq('id', user.id)
    .single();

  if (!profile?.restaurant_id || profile.role === 'motoboy') {
    redirect('/login');
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: profile.role as UserRole,
    restaurantId: profile.restaurant_id,
    restaurantName:
      (profile as { restaurants?: { name?: string } | null }).restaurants?.name ?? 'Restaurante',
    fullName: profile.full_name,
  };
});

/**
 * Contexto para rotas de API. Retorna null (não redireciona) quando não
 * autorizado — a rota decide o status HTTP.
 */
export const getApiContext = cache(async function getApiContext(): Promise<RestaurantContext | null> {
  const supabase = await createLeevaServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('users')
    .select('role, full_name, restaurant_id, restaurants(name)')
    .eq('id', user.id)
    .single();
  if (!profile?.restaurant_id || profile.role === 'motoboy') return null;
  return {
    userId: user.id,
    email: user.email ?? null,
    role: profile.role as UserRole,
    restaurantId: profile.restaurant_id,
    restaurantName:
      (profile as { restaurants?: { name?: string } | null }).restaurants?.name ?? 'Restaurante',
    fullName: profile.full_name,
  };
});

/**
 * Cliente com service_role para uso nas rotas de API/serviços DEPOIS de já
 * ter validado o contexto do usuário. Os serviços recebem este cliente e
 * nós garantimos o escopo por restaurant_id na aplicação.
 */
export function adminDb() {
  return createLeevaAdminClient();
}
