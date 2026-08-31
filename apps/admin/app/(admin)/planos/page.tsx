import { adminDb } from '@/lib/context';
import { PlansEditor } from './PlansEditor';

export const dynamic = 'force-dynamic';

export default async function Planos() {
  const { data } = await adminDb().from('plans').select('*').order('sort_order');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Planos</h1>
          <div className="sub">Configuração do catálogo SaaS — sem deploy</div>
        </div>
      </div>
      <PlansEditor initial={(data ?? []) as never} />
      <p className="muted" style={{ fontSize: 12 }}>
        As <code>features</code> controlam o que cada plano libera (heatmap, rede Leeva, API, limites). Nada disso é hardcoded no app.
      </p>
    </>
  );
}
