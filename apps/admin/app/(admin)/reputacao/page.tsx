import { adminDb } from '@/lib/context';
import { getReputationConfig } from '@leeva/shared/services';
import { ReputationEditor } from './ReputationEditor';

export const dynamic = 'force-dynamic';

export default async function Reputacao() {
  const cfg = await getReputationConfig(adminDb());
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reputação</h1>
          <div className="sub">Pesos e limiares do índice de confiabilidade do entregador</div>
        </div>
      </div>
      <ReputationEditor initial={cfg as never} />
      <p className="muted" style={{ fontSize: 12 }}>
        Nenhum indicador domina sozinho: os pesos somam-se e são normalizados. Recusar oferta classificada como
        <b> poor</b> nunca penaliza — só ofertas <b>excellent/good</b> contam para a aceitação, e com impacto suave.
      </p>
    </>
  );
}
