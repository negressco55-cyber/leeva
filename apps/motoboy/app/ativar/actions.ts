'use server';

import { redirect } from 'next/navigation';
import { createLeevaAdminClient, createLeevaServerClient } from '@leeva/shared/server';
import { onlyDigits, isSupabaseAdminConfigured } from '@leeva/shared';

export type ActivateState = { error?: string };

/**
 * Ativação da conta do motoboy.
 *
 * Pré-condição: o restaurante já cadastrou o motoboy (linha em `motoboys`
 * com o telefone e `user_id` NULL).
 *
 * Passos:
 *  1. acha a linha em `motoboys` pelo telefone, ainda sem conta
 *  2. cria o usuário no Auth (role=motoboy) -> trigger cria linha em `users`
 *  3. liga tudo: users.restaurant_id e motoboys.user_id
 *  4. faz login
 */
export async function activateMotoboy(
  _prev: ActivateState,
  formData: FormData,
): Promise<ActivateState> {
  const phone = onlyDigits(String(formData.get('phone') ?? ''));
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!isSupabaseAdminConfigured()) {
    return { error: 'Banco de dados ainda não configurado (veja as instruções na tela inicial).' };
  }
  if (phone.length < 10 || !email || password.length < 6) {
    return { error: 'Confira telefone, e-mail e senha (mínimo 6 caracteres).' };
  }

  const admin = createLeevaAdminClient();

  // 1. procura o motoboy pré-cadastrado (compara só os dígitos do telefone)
  const { data: candidates } = await admin
    .from('motoboys')
    .select('id, restaurant_id, full_name, phone, user_id')
    .is('user_id', null);

  const motoboy = (candidates ?? []).find((m) => onlyDigits(m.phone) === phone);

  if (!motoboy) {
    return {
      error:
        'Não encontramos um cadastro com esse telefone. Peça para o restaurante te cadastrar primeiro.',
    };
  }

  // 2. cria o usuário no Auth
  const { data: created, error: uErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'motoboy', full_name: motoboy.full_name, phone: motoboy.phone },
  });

  if (uErr || !created.user) {
    return { error: `Falha ao criar usuário: ${uErr?.message ?? 'desconhecido'}` };
  }

  // 3. liga usuário <-> motoboy <-> restaurante
  await admin
    .from('users')
    .update({ restaurant_id: motoboy.restaurant_id })
    .eq('id', created.user.id);

  const { error: linkErr } = await admin
    .from('motoboys')
    .update({ user_id: created.user.id })
    .eq('id', motoboy.id);

  if (linkErr) {
    return { error: `Conta criada, mas falhou ao vincular: ${linkErr.message}` };
  }

  // 4. login
  const supabase = await createLeevaServerClient();
  const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
  if (sErr) return { error: `Conta ativada, mas o login falhou: ${sErr.message}` };

  redirect('/status');
}
