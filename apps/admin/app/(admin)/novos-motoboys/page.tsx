import { adminDb } from '@/lib/context';
import { getPendingDrivers } from '@leeva/shared/services';
import { ApproveButtons } from './ApproveButtons';

export const dynamic = 'force-dynamic';

export default async function NovosMotoboys() {
  const pending = await getPendingDrivers(adminDb());

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Novos motoboys</h1>
          <div className="sub">{pending.length} cadastro(s) aguardando aprovação</div>
        </div>
      </div>

      {pending.length === 0 && <div className="card muted">Nenhum cadastro pendente.</div>}

      {pending.map((d) => (
        <div className="card" key={d.id}>
          <div className="grid-2">
            <div>
              <div className="card-title">{d.fullName}</div>
              <dl className="kv">
                <dt>Telefone</dt>
                <dd>{d.phone}</dd>
                <dt>CPF</dt>
                <dd>{d.cpf ?? '—'}</dd>
                <dt>Cidade</dt>
                <dd>{d.city ?? '—'}</dd>
                <dt>Chave Pix</dt>
                <dd>{d.pixKey ?? '—'} <span className="muted">({d.pixKeyType})</span></dd>
                <dt>Enviado</dt>
                <dd>{new Date(d.createdAt).toLocaleString('pt-BR')}</dd>
              </dl>
            </div>
            <div>
              <div className="card-title">Documentos</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {d.personalDocUrl ? (
                  <a className="btn sm" href={d.personalDocUrl} target="_blank" rel="noreferrer">
                    📄 Documento pessoal
                  </a>
                ) : (
                  <span className="tag red">sem documento pessoal</span>
                )}
                {d.vehicleDocUrl ? (
                  <a className="btn sm" href={d.vehicleDocUrl} target="_blank" rel="noreferrer">
                    🚗 Documento do veículo
                  </a>
                ) : (
                  <span className="tag red">sem documento do veículo</span>
                )}
              </div>
              <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                Links expiram em 10 min. A validação de Receita / antecedentes é feita fora daqui.
              </p>
            </div>
          </div>
          <ApproveButtons motoboyId={d.id} name={d.fullName} />
        </div>
      ))}
    </>
  );
}
