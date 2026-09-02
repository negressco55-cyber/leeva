import { withSentryConfig } from '@sentry/nextjs/config';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compila o pacote do monorepo direto do TypeScript (sem build separado).
  transpilePackages: ['@leeva/shared'],
};

// Sentry: só faz upload de source map / release quando há org+token+DSN.
// Sem isso, `withSentryConfig` só adiciona a instrumentação (inofensivo).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
});
