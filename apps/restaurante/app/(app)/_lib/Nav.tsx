'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: 'Visão geral', icon: '🏠' },
  { href: '/pedidos', label: 'Pedidos', icon: '📦' },
  { href: '/mapa', label: 'Mapa', icon: '🗺️' },
  { href: '/indicadores', label: 'Indicadores', icon: '📊' },
  { href: '/financeiro', label: 'Financeiro', icon: '💰' },
  { href: '/integracoes', label: 'Integrações', icon: '🔌' },
  { href: '/configuracoes', label: 'Configurações', icon: '⚙️' },
];

export function Nav({ showTeam }: { showTeam: boolean }) {
  const pathname = usePathname();
  const links = showTeam
    ? [...NAV.slice(0, 3), { href: '/equipe', label: 'Minha equipe', icon: '🛵' }, ...NAV.slice(3)]
    : NAV;
  return (
    <>
      {links.map((n) => (
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
