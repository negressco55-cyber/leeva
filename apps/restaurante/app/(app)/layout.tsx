import { redirect } from 'next/navigation';
import { requireRestaurantContext, adminDb } from '@/lib/context';
import { ensureSubscription } from '@leeva/shared/services';
import { logout } from '../login/actions';
import { Nav } from './_lib/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRestaurantContext();
  const db = adminDb();

  // onboarding obrigatório antes de usar o painel
  const { data: rst } = await db
    .from('restaurants')
    .select('onboarding_completed, fleet_mode')
    .eq('id', ctx.restaurantId)
    .maybeSingle();

  await ensureSubscription(db, ctx.restaurantId).catch(() => {});

  if (!rst?.onboarding_completed) {
    redirect('/onboarding');
  }

  // Fase 5: o restaurante não cadastra mais motoboy — todos vêm da rede Leeva
  // (self-service + aprovação central). "Minha equipe" fica escondida.
  const showTeam = false;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Leeva
          <small>{ctx.restaurantName}</small>
        </div>
        <Nav showTeam={showTeam} />
        <div className="spacer" />
        <div className="side-foot">
          {ctx.fullName ?? ctx.email}
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
