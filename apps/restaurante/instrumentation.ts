/**
 * Sentry — hook de instrumentação do Next. Só carrega o config do runtime
 * correto. Tudo NO-OP enquanto SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN estiverem
 * vazios. Ver docs/SENTRY-SETUP.md.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs';
