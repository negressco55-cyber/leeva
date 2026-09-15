/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@leeva/shared'],
  experimental: {
    // /quero-entregar manda os documentos (CNH/RG + CRLV, até 5 MB cada) via
    // Server Action — o padrão do Next (1 MB) estourava e quebrava o cadastro.
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
