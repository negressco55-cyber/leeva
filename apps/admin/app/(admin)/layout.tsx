import { requireAdminContext } from '@/lib/context';
import { logout } from '../login/actions';
import { Nav } from './_lib/Nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdminContext();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Leeva Admin
          <small>Plataforma</small>
        </div>
        <Nav />
        <div className="spacer" />
        <div className="side-foot">
          {ctx.name ?? ctx.email}
          <form action={logout} style={{ marginTop: 6 }}>
            <button className="btn sm" type="submit" style={{ width: '100%' }}>
              Sair
            </button>
          </form>
        </div>
      </aside>
      <main className="main-area">{children}</main>
    </div>
  );
}
