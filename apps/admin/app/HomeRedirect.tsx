'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * O link de recuperação de senha do Supabase entrega a sessão no fragmento
 * da URL (#access_token=...&type=recovery) — se a raiz redirecionar no
 * servidor, esse fragmento se perde (nunca chega no servidor) e a pessoa
 * cai direto no login sem poder trocar a senha. Por isso isso roda no
 * navegador: confere o fragmento antes de decidir pra onde mandar.
 */
export default function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('type=magiclink')) {
      router.replace(`/redefinir-senha${hash}`);
      return;
    }
    router.replace('/visao-geral');
  }, [router]);

  return null;
}
