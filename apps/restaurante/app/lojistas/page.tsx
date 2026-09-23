import type { Metadata } from 'next';
import Landing from '../_landing/Landing';
import { landingMetadata } from '../_landing/metadata';

export const metadata: Metadata = landingMetadata;

/** Link fixo para divulgar (a raiz também mostra a landing pra visitantes). */
export default function LojistasPage() {
  return <Landing />;
}
