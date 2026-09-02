/**
 * Prévia visual da rota — coleta → entrega. Sem tiles nem biblioteca de
 * mapa: um traço simples, orientado pela direção real entre os dois pontos,
 * sobre uma grade discreta. "Simplificado" de propósito: carrega instantâneo
 * dentro do card de oferta.
 */
export default function RouteMini({
  pickup,
  dropoff,
  pickupKm,
  totalKm,
  height = 96,
}: {
  pickup: { lat: number; lng: number } | null;
  dropoff: { lat: number; lng: number } | null;
  pickupKm?: number | null;
  totalKm?: number | null;
  height?: number;
}) {
  const W = 300;
  const H = height;
  const pad = 22;

  // posiciona os dois pontos preservando a direção real (bearing) entre eles
  let ax = pad,
    ay = H - pad,
    bx = W - pad,
    by = pad;
  if (pickup && dropoff) {
    const dx = dropoff.lng - pickup.lng;
    const dy = pickup.lat - dropoff.lat; // y do svg cresce pra baixo
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const cx = W / 2;
    const cy = H / 2;
    // escala o vetor para o traço tocar as bordas da caixa, mantendo a direção
    const sx = ux !== 0 ? (W / 2 - pad) / Math.abs(ux) : Infinity;
    const sy = uy !== 0 ? (H / 2 - pad) / Math.abs(uy) : Infinity;
    const s = Math.min(sx, sy);
    ax = cx - ux * s;
    ay = cy - uy * s;
    bx = cx + ux * s;
    by = cy + uy * s;
  }

  return (
    <div className="route-mini" aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
        <defs>
          <pattern id="rm-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke="var(--border)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="var(--surface-2)" />
        <rect width={W} height={H} fill="url(#rm-grid)" />
        <line
          x1={ax}
          y1={ay}
          x2={bx}
          y2={by}
          stroke="var(--brand)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="1 7"
        />
        {/* coleta */}
        <circle cx={ax} cy={ay} r="7" fill="var(--warn)" stroke="var(--surface)" strokeWidth="2.5" />
        {/* entrega */}
        <circle cx={bx} cy={by} r="7" fill="var(--brand)" stroke="var(--surface)" strokeWidth="2.5" />
      </svg>
      <div className="route-mini-legend">
        <span><i className="rm-dot warn" /> coleta{pickupKm != null ? ` · ${pickupKm.toFixed(1)} km` : ''}</span>
        <span><i className="rm-dot brand" /> entrega{totalKm != null ? ` · ${totalKm.toFixed(1)} km` : ''}</span>
      </div>
    </div>
  );
}
