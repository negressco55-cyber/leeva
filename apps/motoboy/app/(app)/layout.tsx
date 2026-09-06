import Link from 'next/link';
import { requireMotoboyContext, adminDb } from '@/lib/context';
import { getActiveTerms, needsTermsAcceptance } from '@leeva/shared/services';
import LocationSender from './LocationSender';
import OffersPanel from './OffersPanel';
import { OnboardingGate } from './_lib/OnboardingGate';

const TABS = [
  { href: '/status', label: 'Status' },
  { href: '/entrega', label: 'Entrega' },
  { href: '/historico', label: 'Histórico' },
  { href: '/pagamentos', label: 'Pagamentos' },
  { href: '/perfil', label: 'Perfil' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireMotoboyContext();

  // GATE: aprovação + termos antes de usar o app
  if (ctx.approvalStatus === 'pending_approval') return <OnboardingGate state="pending_approval" />;
  if (ctx.approvalStatus === 'rejected')
    return <OnboardingGate state="rejected" reason={ctx.approvalReason} />;
  const terms = await getActiveTerms(adminDb());
  if (terms && needsTermsAcceptance(ctx.termsAcceptedVersion, terms.version))
    return <OnboardingGate state="terms" terms={terms} />;

  return (
    <div className="screen">
      {children}

      <OffersPanel motoboyId={ctx.motoboyId} />
      <LocationSender active={ctx.status !== 'offline'} />

      <nav className="tabbar">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="badge">
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
