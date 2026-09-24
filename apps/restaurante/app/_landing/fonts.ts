import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from 'next/font/google';

// Só a landing usa estas fontes (o painel continua em Inter).
export const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--lv-display',
  display: 'swap',
});
export const body = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--lv-body',
  display: 'swap',
});
export const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--lv-mono',
  display: 'swap',
});
