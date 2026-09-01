import { requireMotoboyContext, adminDb } from '@/lib/context';
import { getDriverPerformance } from '@leeva/shared/services';

export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default async function Desempenho() {
  const ctx = await requireMotoboyContext();
  const p = await getDriverPerformance(adminDb(), ctx.motoboyId);

  if (!p) {
    return (
      <div className="panel">
        <h2>Seu desempenho</h2>
        <p className="muted">Ainda não há dados suficientes.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Seu desempenho</h2>

      <div style={{ textAlign: 'center', margin: '12px 0' }}>
        <div style={{ fontSize: 40, fontWeight: 650 }}>{Math.round(p.reliabilityIndex)}</div>
        <div className="muted">Índice de confiabilidade</div>
      </div>

      <Row label="⭐ Avaliação" value={p.rating.toFixed(1)} />
      <Row label="Aceitação de ofertas adequadas" value={`${Math.round(p.acceptanceRate)}%`} />
      <Row label="Finalização" value={`${Math.round(p.completionRate)}%`} />
      <Row label="Pontualidade" value={`${Math.round(p.punctualityRate)}%`} />

      <p style={{ marginTop: 14, fontWeight: 600 }}>{p.explanation}</p>
      {p.tips.length > 0 && (
        <ul style={{ marginTop: 8, paddingLeft: 18 }}>
          {p.tips.map((t, i) => (
            <li key={i} className="muted" style={{ marginBottom: 4 }}>{t}</li>
          ))}
        </ul>
      )}

      {p.blocked && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--danger-weak)', color: 'var(--danger)' }}>
          Sua conta está temporariamente pausada{p.blockedReason ? `: ${p.blockedReason}` : ''}. Fale com o suporte.
        </div>
      )}

      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
        Recusar uma oferta pouco vantajosa não afeta seu índice. Só ofertas boas contam para a aceitação.
      </p>
    </div>
  );
}
