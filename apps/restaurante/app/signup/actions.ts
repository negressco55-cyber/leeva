'use server';

import { redirect } from 'next/navigation';
import { isSupabaseAdminConfigured } from '@leeva/shared';
import { createLeevaAdminClient, createLeevaServerClient } from '@leeva/shared/server';

export type SignupState = { error?: string };

/**
 * Cadastro do restaurante:
 *  1. cria o registro em `restaurants`
 *  2. cria o usuário no Auth já com metadata (role=owner + restaurant_id)
 *     -> a trigger handle_new_auth_user cria a linha em `users`
 *  3. faz login
 */
export async function signupRestaurant(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const restaurantName = String(formData.get('restaurantName') ?? '').trim();
  const fullName = String(formData.get('fullName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!isSupabaseAdminConfigured()) {
    return { error: 'Banco de dados ainda não configurado (veja as instruções na página inicial).' };
  }
  if (!restaurantName || !fullName || !email || password.length < 6) {
    return { error: 'Preencha todos os campos (senha com no mínimo 6 caracteres).' };
  }

  const admin = createLeevaAdminClient();

  const { data: restaurant, error: rErr } = await admin
    .from('restaurants')
    .insert({ name: restaurantName })
    .select('id')
    .single();

  if (rErr || !restaurant) {
    return { error: `Falha ao criar restaurante: ${rErr?.message ?? 'desconhecido'}` };
  }

  const { error: uErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'restaurant_owner',
      full_name: fullName,
      restaurant_id: restaurant.id,
    },
  });

  if (uErr) {
    // desfaz o restaurante órfão
    await admin.from('restaurants').delete().eq('id', restaurant.id);
    return { error: `Falha ao criar usuário: ${uErr.message}` };
  }

  const supabase = await createLeevaServerClient();
  const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
  if (sErr) return { error: `Conta criada, mas o login falhou: ${sErr.message}` };

  redirect('/dashboard');
}
