'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>
        <h1 style={{ fontSize: 20 }}>Algo deu errado</h1>
        <p style={{ color: '#666' }}>
          A tela travou. Recarregue a página — se continuar, avise o suporte.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px solid #ccc', cursor: 'pointer' }}
        >
          Recarregar
        </button>
      </body>
    </html>
  );
}
