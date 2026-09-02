import * as Sentry from '@sentry/nextjs';
import { registerErrorReporter } from '@leeva/shared/services';

const DSN = process.env.SENTRY_DSN || '';

Sentry.init({
  dsn: DSN || undefined,
  enabled: Boolean(DSN),
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',
  tracesSampleRate: 0,
  sendDefaultPii: false,
});

// liga o ponto único de captura de erro do @leeva/shared no Sentry
if (DSN) {
  registerErrorReporter({
    captureException: (e, hint) => Sentry.captureException(e, hint as never),
  });
}
