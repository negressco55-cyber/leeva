import Link from 'next/link';
import { BadgeCheck, ChevronRight, FileText, MapPin, Phone, ShieldCheck, Star, TrendingUp, User, Wallet } from 'lucide-react';
import { requireMotoboyContext, adminDb } from '@/lib/context';
import { getMotoboyPixInfo } from '@leeva/shared/services';
import { logout } from '../../login/actions';
import Avatar from '../_lib/Avatar';
import { ThemeToggle } from '../_lib/ThemeToggle';

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
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>Perfil</h1>

      <div className="profile-id profile-id--row">
        <Avatar name={ctx.fullName} src={null} size={56} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className="name">{ctx.fullName}</span>
          {m?.city && <span className="muted">{m.city}</span>}
        </div>
      </div>

      <div className="section-title">Desempenho</div>
      <div className="row" style={{ gap: 10 }}>
        <div className="panel" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
          <Star size={15} color="var(--muted)" strokeWidth={2} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 650 }}>{m?.rating != null ? Number(m.rating).toFixed(1) : '—'}</div>
            <div className="muted" style={{ fontSize: 11 }}>nota média</div>
          </div>
        </div>
        <div className="panel" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
          <TrendingUp size={15} color="var(--muted)" strokeWidth={2} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 650 }}>{m?.deliveries_completed ?? 0}</div>
            <div className="muted" style={{ fontSize: 11 }}>entregas</div>
          </div>
        </div>
      </div>

      <div className="section-title">Dados pessoais</div>
      <div className="icon-rows">
        <div className="icon-row">
          <span className="icon-row-icon"><User size={16} strokeWidth={2} /></span>
          <div>
            <div className="icon-row-label">Nome</div>
            <div className="icon-row-value">{ctx.fullName}</div>
          </div>
        </div>
        <div className="icon-row">
          <span className="icon-row-icon"><Phone size={16} strokeWidth={2} /></span>
          <div>
            <div className="icon-row-label">Telefone</div>
            <div className="icon-row-value">{m?.phone ?? 'Não informado'}</div>
          </div>
        </div>
        <div className="icon-row">
          <span className="icon-row-icon"><MapPin size={16} strokeWidth={2} /></span>
          <div>
            <div className="icon-row-label">Cidade</div>
            <div className="icon-row-value">{m?.city ?? 'Não informada'}</div>
          </div>
        </div>
        <div className="icon-row">
          <span className="icon-row-icon"><BadgeCheck size={16} strokeWidth={2} /></span>
          <div>
            <div className="icon-row-label">Cadastro</div>
            <div className="icon-row-value">{APPROVAL[ctx.approvalStatus] ?? '—'}</div>
          </div>
        </div>
      </div>

      <div className="section-title">Documentos</div>
      <div className="icon-rows">
        <Link href="/documentos" className="icon-row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="icon-row-icon"><FileText size={16} strokeWidth={2} /></span>
          <div style={{ flex: 1 }}>
            <div className="icon-row-label">CRLV e foto do rosto</div>
            <div className="icon-row-value">Enviar ou atualizar</div>
          </div>
          <ChevronRight size={16} color="var(--faint)" />
        </Link>
      </div>

      <div className="section-title">Recebimento</div>
      <div className="icon-rows">
        <Link href="/pagamentos" className="icon-row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="icon-row-icon"><Wallet size={16} strokeWidth={2} /></span>
          <div style={{ flex: 1 }}>
            <div className="icon-row-label">Chave Pix (repasse)</div>
            <div className="icon-row-value">{pix.masked ?? 'Cadastrar'}</div>
          </div>
          <ChevronRight size={16} color="var(--faint)" />
        </Link>
        <Link href="/pagamentos" className="icon-row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="icon-row-icon"><Wallet size={16} strokeWidth={2} /></span>
          <div style={{ flex: 1 }}>
            <div className="icon-row-label">Pagamentos e repasses</div>
          </div>
          <ChevronRight size={16} color="var(--faint)" />
        </Link>
        <Link href="/desempenho" className="icon-row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="icon-row-icon"><TrendingUp size={16} strokeWidth={2} /></span>
          <div style={{ flex: 1 }}>
            <div className="icon-row-label">Desempenho detalhado</div>
          </div>
          <ChevronRight size={16} color="var(--faint)" />
        </Link>
      </div>

      <div className="section-title">Conta</div>
      <div className="icon-rows">
        <div className="icon-row">
          <span className="icon-row-icon"><ShieldCheck size={16} strokeWidth={2} /></span>
          <div>
            <div className="icon-row-label">Termos de uso</div>
            <div className="icon-row-value">{ctx.termsAcceptedVersion ? `aceitos (v${ctx.termsAcceptedVersion})` : '—'}</div>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <form action={logout}>
        <button className="button danger" type="submit">
          Sair
        </button>
      </form>
    </div>
  );
}
