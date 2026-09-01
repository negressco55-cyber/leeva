import { supabase } from '../lib/supabase';

export async function signIn(email: string, senha: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    throw new Error(
      /invalid login credentials/i.test(error.message)
        ? 'E-mail ou senha incorretos.'
        : error.message,
    );
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
