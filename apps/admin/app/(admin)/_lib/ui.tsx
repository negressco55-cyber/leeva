import Link from 'next/link';

export const money = (n: number | null | undefined) =>
  n == null ? '—' : `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const num = (n: number | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR');
export const pctText = (n: number | null | undefined) => (n == null ? '—' : `${n}%`);

export function Delta({ value }: { value: number | null }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span style={{ fontSize: 12, color: up ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
      {up ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  );
}

export function StatCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: number | null;
  hint?: string;
}) {
  return (
    <div className="stat">
      <div className="v" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span>{value}</span>
        {delta !== undefined && <Delta value={delta ?? null} />}
      </div>
      <div className="l">{label}</div>
      {hint && <div className="muted" style={{ fontSize: 11 }}>{hint}</div>}
    </div>
  );
}

export function PeriodNav({ base, current }: { base: string; current: string }) {
  const opts: [string, string][] = [
    ['today', 'Hoje'],
    ['7d', '7 dias'],
    ['30d', '30 dias'],
    ['month', 'Mês'],
  ];
  return (
    <div className="seg">
      {opts.map(([v, l]) => (
        <Link key={v} href={`${base}?p=${v}`} className={`seg-btn ${current === v ? 'active' : ''}`}>
          {l}
        </Link>
      ))}
    </div>
  );
}
