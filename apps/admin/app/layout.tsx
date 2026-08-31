import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Leeva Admin',
  description: 'Painel da plataforma Leeva',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
