/**
 * Ícones de traço, no mesmo estilo do Nav (app/(app)/_lib/Nav.tsx) — usados
 * onde a UI usava emoji como ícone (proibido em produção pelo
 * docs/DESIGN-SYSTEM.md; emoji só em mensagem pontual, não como elemento
 * visual). Cor via `currentColor` — herda do texto ao redor.
 */
import type { ReactNode, SVGProps } from 'react';

const PATHS = {
  star: <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" />,
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.5 5.5 13 13" />
    </>
  ),
  message: <path d="M4 5h16v11H9l-5 4Z" />,
  whatsapp: (
    <>
      <path d="M12 3a8.5 8.5 0 0 0-7.3 12.9L3 21l5.3-1.6A8.5 8.5 0 1 0 12 3Z" />
      <path d="M8.3 8.6c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .5.4.2.5.6 1.5.6 1.6.1.1.1.3 0 .4-.1.2-.2.3-.3.5-.2.2-.3.3-.1.5.6 1 1.3 1.6 2.3 2.1.2.1.3.1.5-.1l.5-.6c.1-.2.3-.2.5-.1l1.4.7c.2.1.3.1.3.3 0 .8-.3 1.6-1.4 1.9-.7.2-1.6.3-3.5-.7-2-1-3.2-2.9-3.4-3.2-.2-.3-1.2-1.6-1.1-3.1.1-.7.5-1 .7-1.1Z" fill="currentColor" stroke="none" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M8 12h8M8 16h8" />
    </>
  ),
  car: (
    <>
      <path d="M5 16 6.5 9.5A2 2 0 0 1 8.4 8h7.2a2 2 0 0 1 1.9 1.5L19 16" />
      <path d="M3.5 16h17v3h-3v-1.5h-11V19h-3z" />
      <circle cx="7.5" cy="16" r="1.5" />
      <circle cx="16.5" cy="16" r="1.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  alert: (
    <>
      <path d="M12 3.5 21 19H3z" />
      <path d="M12 9.5v4M12 16.5v.1" />
    </>
  ),
  bell: (
    <>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  store: (
    <>
      <path d="M4 9h16l-1-5H5L4 9z" />
      <path d="M5 9v11h14V9" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l4 2" />
    </>
  ),
  party: (
    <>
      <path d="M4 20 14 4l6 6L4 20Z" />
      <path d="M9 9.5 14.5 15" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
      style={{ display: 'inline-block', verticalAlign: '-0.15em', flexShrink: 0, ...rest.style }}
    >
      {PATHS[name]}
    </svg>
  );
}
