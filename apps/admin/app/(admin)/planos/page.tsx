import { adminDb } from '@/lib/context';
import { DEFAULT_PAYOUT_CONFIG } from '@leeva/shared/services';
import { PlansEditor } from './PlansEditor';
import { FeeTableEditor } from './FeeTableEditor';

export const dynamic = 'force-dynamic';

export default async function Planos() {
  const db = adminDb();
  const [{ data: plans }, { data: policy }] = await Promise.all([
    db.from('plans').select('*').order('sort_order'),
    db.from('payout_policies').select('config').is('restaurant_id', null).maybeSingle(),
  ]);
  const cfg = { ...DEFAULT_PAYOUT_CONFIG, ...((policy?.config as object) ?? {}) };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Planos & Taxas</h1>
          <div className="sub">Configuração comercial — sem deploy</div>
        </div>
      </div>

      <FeeTableEditor
        initial={{
          base: Number(cfg.base),
          per_km: Number(cfg.per_km),
          free_km: Number(cfg.free_km),
          min_payout: Number(cfg.min_payout),
        }}
      />

      <div className="card-title" style={{ marginTop: 8 }}>Planos SaaS</div>
      <PlansEditor initial={(plans ?? []) as never} />
      <p className="muted" style={{ fontSize: 12 }}>
        <b>Margem por entrega</b> = quanto o Leeva ganha em cada entrega desse plano (somado ao valor do
        entregador = total descontado do crédito do restaurante). As <code>features</code> controlam o que
        cada plano libera. Nada disso é hardcoded.
      </p>
    </>
  );
}
