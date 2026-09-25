import Link from 'next/link';
import { requireMotoboyContext, adminDb } from '@/lib/context';
import { getActiveTerms, needsTermsAcceptance } from '@leeva/shared/services';
import LocationSender from './LocationSender';
import OffersPanel from './OffersPanel';
import { OnboardingGate } from './_lib/OnboardingGate';
import { TabBar } from './_lib/TabBar';
import { Clock } from 'lucide-react';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireMotoboyContext();

  // GATE: só travamos de verdade em reprovado ou termos pendentes. Cadastro
  // "em análise" NÃO bloqueia mais o app — o motoboy navega normal, só não
  // consegue ficar disponível (o servidor recusa em /api/status) até
  // completar os dados e ser aprovado. Isso é o que estava travando o mapa
  // e gerando reclamação no grupo hoje.
  if (ctx.approvalStatus === 'rejected')
    return <OnboardingGate state="rejected" reason={ctx.approvalReason} />;
  const terms = await getActiveTerms(adminDb());
  if (terms && needsTermsAcceptance(ctx.termsAcceptedVersion, terms.version))
    return <OnboardingGate state="terms" terms={terms} />;

  return (
    <div className="screen">
      {ctx.approvalStatus === 'pending_approval' && (
        <Link
          href="/documentos"
          className="panel"
          style={{
            display: 'block',
            margin: '10px 12px 0',
            padding: '10px 14px',
            background: 'var(--brand-weak)',
            color: 'var(--brand)',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> Cadastro em análise — complete seus dados para poder ficar disponível →</span>
        </Link>
      )}

      {children}

      <OffersPanel motoboyId={ctx.motoboyId} />
      <LocationSender active={ctx.status !== 'offline'} />

      <TabBar />
    </div>
  );
}
