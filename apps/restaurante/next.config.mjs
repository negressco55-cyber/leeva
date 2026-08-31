/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compila o pacote do monorepo direto do TypeScript (sem build separado).
  transpilePackages: ['@leeva/shared'],
};

export default nextConfig;
