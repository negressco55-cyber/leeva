import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Leeva Admin',
  description: 'Painel da plataforma Leeva',
};

// Aplica o tema salvo antes da primeira pintura (sem piscar). Padrão: claro.
const themeScript = `(function(){try{if(localStorage.getItem('leeva-theme')==='dark'){document.documentElement.dataset.theme='dark'}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
