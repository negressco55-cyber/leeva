/**
 * Avatar do entregador: foto quando existe, senão as iniciais num círculo.
 * A foto vem da selfie aprovada na verificação de identidade
 * (ver docs/VERIFICACAO-DE-IDENTIDADE.md) — enquanto isso, iniciais.
 */
export default function Avatar({
  name,
  src,
  size = 56,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="avatar"
        style={{ width: size, height: size, objectFit: 'cover' }}
      />
    );
  }

  return (
    <span
      className="avatar avatar--initials"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-label={name}
      role="img"
    >
      {initials || '🛵'}
    </span>
  );
}
