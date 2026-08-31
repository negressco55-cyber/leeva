'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/visao-geral', label: 'Visão geral', icon: '📊' },
  { href: '/operacao', label: 'Operação', icon: '🗺️' },
  { href: '/restaurantes', label: 'Restaurantes', icon: '🏪' },
  { href: '/entregadores', label: 'Entregadores', icon: '🛵' },
  { href: '/financeiro', label: 'Financeiro', icon: '💰' },
  { href: '/planos', label: 'Planos', icon: '🎟️' },
  { href: '/reputacao', label: 'Reputação', icon: '⭐' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <>
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={`side-link ${pathname.startsWith(n.href) ? 'active' : ''}`}
        >
          <span aria-hidden>{n.icon}</span>
          {n.label}
        </Link>
      ))}
    </>
  );
}
