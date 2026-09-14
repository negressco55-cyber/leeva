import { adminDb } from '@/lib/context';
import { getAdminTreasury, listPlatformWithdrawals } from '@leeva/shared/services';
import { money } from '../_lib/ui';
import { WithdrawForm } from './WithdrawForm';

export const dynamic = 'force-dynamic';

export default async function Caixa() {
  const db = adminDb();
  const [t, withdrawals] = await Promise.all([getAdminTreasury(db), listPlatformWithdrawals(db, 30)]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Caixa</h1>
          <div className="sub">Uma conta só — três donos diferentes. Veja quanto é de cada um.</div>
        </div>
      </div>

      <div className="card" style={{ borderLeft: '3px solid #16a34a' }}>
        <div className="card-title">O que é do Leeva, de verdade</div>
        <div style={{ fontSize: 34, fontWeight: 700, color: t.leevaAvailableToWithdraw >= 0 ? '#16a34a' : '#dc2626' }}>
          {money(t.leevaAvailableToWithdraw)}
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Margem de todas as entregas <b>já concluídas</b> ({money(t.leevaMarginEarned)}), menos o que você já sacou
          antes ({money(t.leevaMarginWithdrawn)}). Só este valor é seguro tirar da conta — o resto é dos
          restaurantes ou dos motoboys, mesmo estando no mesmo saldo da Asaas.
        </p>
        <WithdrawForm available={t.leevaAvailableToWithdraw} />
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="v">{money(t.restaurantCreditLiability)}</div>
          <div className="l">Crédito dos restaurantes (ainda não usado)</div>
        </div>
        <div className="stat">
          <div className="v">{money(t.motoboyPendingLiability)}</div>
          <div className="l">Saldo pendente dos motoboys (ainda não sacado)</div>
        </div>
        <div className="stat good">
          <div className="v">{money(t.leevaMarginEarned)}</div>
          <div className="l">Margem já ganha (entregas concluídas)</div>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12 }}>
        Saldo total que deveria estar na conta da Asaas agora, se tudo bater:{' '}
        <b>
          {money(t.restaurantCreditLiability + t.motoboyPendingLiability + t.leevaAvailableToWithdraw)}
        </b>{' '}
        (crédito dos restaurantes + saldo pendente dos motoboys + margem do Leeva ainda não sacada). Se o saldo real
        da Asaas for bem diferente disso, alguma coisa não bateu — vale conferir.
      </p>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="card-title">Restaurantes com crédito</div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Restaurante</th>
              <th style={{ textAlign: 'right' }}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {t.restaurantsWithBalance.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td style={{ textAlign: 'right' }}>{money(r.balance)}</td>
              </tr>
            ))}
            {t.restaurantsWithBalance.length === 0 && (
              <tr><td colSpan={2} className="muted">Nenhum restaurante com saldo.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="card-title">Motoboys com saldo pendente</div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Motoboy</th>
              <th style={{ textAlign: 'right' }}>Pendente</th>
            </tr>
          </thead>
          <tbody>
            {t.motoboysWithPending.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td style={{ textAlign: 'right' }}>{money(m.pending)}</td>
              </tr>
            ))}
            {t.motoboysWithPending.length === 0 && (
              <tr><td colSpan={2} className="muted">Nenhum motoboy com saldo pendente.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="card-title">Saques do Leeva já registrados</div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((w) => (
              <tr key={w.id}>
                <td>{new Date(w.createdAt).toLocaleString('pt-BR')}</td>
                <td>{w.description ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{money(w.amount)}</td>
              </tr>
            ))}
            {withdrawals.length === 0 && <tr><td colSpan={3} className="muted">Nenhum saque registrado ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
