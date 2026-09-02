import * as Sentry from '@sentry/nextjs';

const DSN = process.env.SENTRY_DSN || '';

Sentry.init({
  dsn: DSN || undefined,
  enabled: Boolean(DSN),
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
