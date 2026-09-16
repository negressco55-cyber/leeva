'use server';

import { isSupabaseAdminConfigured } from '@leeva/shared';
import { createLeevaAdminClient } from '@leeva/shared/server';
import { sendVerificationEmail } from '@leeva/shared/services';

export type SignupState = { error?: string; ok?: boolean };

/**
 * Cadastro do restaurante:
 *  1. cria o registro em `restaurants`
 *  2. cria o usuário no Auth (NÃO confirmado) já com metadata (role=owner +
 *     restaurant_id) -> a trigger handle_new_auth_user cria a linha em `users`
 *  3. manda o link de confirmação pelo Resend (não pelo SMTP do Supabase —
 *     mesma razão do reset de senha, ver login/actions.ts)
 *  Só entra no painel depois de confirmar (requireRestaurantContext barra
 *  quem não confirmou).
 */
export async function signupRestaurant(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const restaurantName = String(formData.get('restaurantName') ?? '').trim();
  const fullName = String(formData.get('fullName') ?? '').trim();
  const whatsapp = String(formData.get('whatsapp') ?? '').trim();
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
    .insert({ name: restaurantName, phone: whatsapp || null })
    .select('id')
    .single();

  if (rErr || !restaurant) {
    return { error: `Falha ao criar restaurante: ${rErr?.message ?? 'desconhecido'}` };
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { data, error: uErr } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: {
      redirectTo: base,
      data: {
        role: 'restaurant_owner',
        full_name: fullName,
        restaurant_id: restaurant.id,
      },
    },
  });

  if (uErr || !data?.properties?.action_link) {
    // desfaz o restaurante órfão
    await admin.from('restaurants').delete().eq('id', restaurant.id);
    return { error: `Falha ao criar usuário: ${uErr?.message ?? 'erro desconhecido'}` };
  }

  const sent = await sendVerificationEmail(email, data.properties.action_link);
  if (!sent) {
    return { error: 'Conta criada, mas não foi possível enviar o e-mail de confirmação agora. Tente de novo em instantes.' };
  }

  return { ok: true };
}
