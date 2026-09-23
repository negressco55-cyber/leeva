'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * O link de recuperação de senha do Supabase entrega a sessão no fragmento
 * da URL (#access_token=...&type=recovery) — se a raiz redirecionar no
 * servidor (como fazia antes), esse fragmento se perde (nunca chega no
 * servidor) e a pessoa cai direto no login sem poder trocar a senha.
 * Por isso isso aqui roda no navegador: confere o fragmento antes de
 * decidir pra onde mandar.
 */
/** `stayWhenLoggedOut`: a raiz mostra a landing pra quem não está logado —
 *  aí só tratamos os fragmentos de recuperação/confirmação e ficamos. */
export default function HomeRedirect({ loggedIn, stayWhenLoggedOut = false }: { loggedIn: boolean; stayWhenLoggedOut?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      router.replace(`/redefinir-senha${hash}`);
      return;
    }
    if (hash.includes('type=signup') || hash.includes('type=email_change') || hash.includes('type=magiclink')) {
      // sessão já veio no fragmento (confirmação de e-mail) — só entrar.
      router.replace('/dashboard');
      return;
    }
    if (loggedIn) router.replace('/dashboard');
    else if (!stayWhenLoggedOut) router.replace('/login');
  }, [loggedIn, stayWhenLoggedOut, router]);

  return null;
}
