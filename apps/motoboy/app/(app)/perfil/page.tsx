import Link from 'next/link';
import { requireMotoboyContext, adminDb } from '@/lib/context';
import { getMotoboyPixInfo } from '@leeva/shared/services';
import { logout } from '../../login/actions';
import Avatar from '../_lib/Avatar';

export const dynamic = 'force-dynamic';

const APPROVAL: Record<string, string> = {
  pending_approval: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Não aprovado',
};

export default async function PerfilPage() {
  const ctx = await requireMotoboyContext();
  const db = adminDb();

  const [{ data: m }, pix] = await Promise.all([
    db
      .from('motoboys')
      // avatar_url entra quando a migration 0030 for aplicada + houver upload
      // (selfie da verificação de identidade). Até lá, Avatar mostra iniciais.
      .select('phone, city, rating, deliveries_completed')
      .eq('id', ctx.motoboyId)
      .maybeSingle(),
    getMotoboyPixInfo(db, ctx.motoboyId),
  ]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <h1 style={{ margin: 0 }}>Perfil</h1>

      <div className="profile-id profile-id--row">
        <Avatar name={ctx.fullName} src={null} size={60} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="name">{ctx.fullName}</span>
          {m?.phone && <span className="muted">{m.phone}</span>}
          {m?.city && <span className="muted">{m.city}</span>}
        </div>
      </div>

      <div className="row" style={{ gap: 12 }}>
        <div className="panel" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {m?.rating != null ? Number(m.rating).toFixed(1) : '—'}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>nota média</div>
        </div>
        <div className="panel" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{m?.deliveries_completed ?? 0}</div>
          <div className="muted" style={{ fontSize: 13 }}>entregas feitas</div>
        </div>
      </div>

      <div className="profile-list">
        <div className="profile-row">
          <span className="k">Cadastro</span>
          <span className="v">{APPROVAL[ctx.approvalStatus] ?? '—'}</span>
        </div>
        <Link href="/pagamentos" className="profile-row">
          <span className="k">Chave Pix (repasse)</span>
          <span className="v chev">{pix.masked ?? 'Cadastrar'}</span>
        </Link>
        <Link href="/pagamentos" className="profile-row">
          <span className="k">Pagamentos e repasses</span>
          <span className="v chev" />
        </Link>
        <Link href="/desempenho" className="profile-row">
          <span className="k">Desempenho</span>
          <span className="v chev" />
        </Link>
        <div className="profile-row">
          <span className="k">Termos de uso</span>
          <span className="v">
            {ctx.termsAcceptedVersion ? `aceitos (v${ctx.termsAcceptedVersion})` : '—'}
          </span>
        </div>
      </div>

      <form action={logout}>
        <button className="button danger" type="submit">
          Sair
        </button>
      </form>
    </div>
  );
}
