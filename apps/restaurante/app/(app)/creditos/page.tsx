import { requireRestaurantContext, adminDb } from '@/lib/context';
import { getCreditBalance, getCreditHistory, getCreditPackages } from '@leeva/shared/services';
import { CreditsClient } from './CreditsClient';

export const dynamic = 'force-dynamic';

export default async function CreditosPage() {
  const ctx = await requireRestaurantContext();
  const db = adminDb();
  const [balance, history, packages] = await Promise.all([
    getCreditBalance(db, ctx.restaurantId),
    getCreditHistory(db, ctx.restaurantId, 50),
    getCreditPackages(db),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Créditos</h1>
          <div className="sub">Cada entrega desconta o custo total do seu saldo. A mensalidade é cobrada à parte.</div>
        </div>
      </div>
      <CreditsClient
        initial={{ ...balance, history, packages }}
        canBuy={ctx.role === 'restaurant_owner'}
      />
    </>
  );
}
