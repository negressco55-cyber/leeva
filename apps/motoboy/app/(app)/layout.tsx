import Link from 'next/link';
import { requireMotoboyContext } from '@/lib/context';
import { logout } from '../login/actions';
import LocationSender from './LocationSender';
import OffersPanel from './OffersPanel';

const TABS = [
  { href: '/status', label: 'Status' },
  { href: '/entrega', label: 'Entrega' },
  { href: '/historico', label: 'Histórico' },
  { href: '/desempenho', label: 'Desempenho' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireMotoboyContext();

  return (
    <div className="screen">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <strong>{ctx.fullName}</strong>
        <form action={logout}>
          <button className="button secondary" style={{ width: 'auto', padding: '8px 12px' }}>
            Sair
          </button>
        </form>
      </header>

      {children}

      <OffersPanel motoboyId={ctx.motoboyId} />
      <LocationSender active={ctx.status !== 'offline'} />

      <nav className="tabbar">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="badge">
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
