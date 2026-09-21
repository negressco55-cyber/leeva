'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Link de recuperação de senha traz a sessão no fragmento da URL, que o
 *  servidor nunca vê — por isso o redirecionamento da raiz roda aqui. */
export default function HomeRedirect({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      router.replace(`/redefinir-senha${hash}`);
      return;
    }
    router.replace(loggedIn ? '/status' : '/login');
  }, [loggedIn, router]);
  return null;
}
