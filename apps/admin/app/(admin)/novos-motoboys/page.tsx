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

      {pending.map((d) => {
        const complete = !!(d.cpf && d.city && d.personalDocUrl && d.personalDocBackUrl && d.vehicleDocUrl && d.avatarUrl);
        return (
        <div className="card" key={d.id}>
          <div className="grid-2">
            <div>
              <div className="card-title">
                {d.fullName}
                {!complete && <span className="tag" style={{ marginLeft: 8 }}>cadastro incompleto</span>}
              </div>
              <dl className="kv">
                <dt>WhatsApp</dt>
                <dd>
                  <a href={`https://wa.me/${d.phone.replace(/D/g, '').startsWith('55') ? d.phone.replace(/D/g, '') : '55' + d.phone.replace(/D/g, '')}`} target="_blank" rel="noreferrer">
                    💬 {d.phone} (chamar no WhatsApp)
                  </a>
                </dd>
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
                    📄 Documento pessoal (frente)
                  </a>
                ) : (
                  <span className="tag red">sem documento pessoal (frente)</span>
                )}
                {d.personalDocBackUrl ? (
                  <a className="btn sm" href={d.personalDocBackUrl} target="_blank" rel="noreferrer">
                    📄 Documento pessoal (verso)
                  </a>
                ) : (
                  <span className="tag red">sem documento pessoal (verso)</span>
                )}
                {d.vehicleDocUrl ? (
                  <a className="btn sm" href={d.vehicleDocUrl} target="_blank" rel="noreferrer">
                    🚗 Documento do veículo
                  </a>
                ) : (
                  <span className="tag red">sem documento do veículo</span>
                )}
                {d.avatarUrl ? (
                  <a className="btn sm" href={d.avatarUrl} target="_blank" rel="noreferrer">
                    🙂 Selfie (rosto)
                  </a>
                ) : (
                  <span className="tag red">sem selfie</span>
                )}
              </div>
              <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                Links expiram em 3 dias — se der erro, atualize a página. A validação de Receita / antecedentes é feita fora daqui.
              </p>
              {!complete && (
                <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  Cadastro rápido — o motoboy ainda não terminou de enviar CPF/cidade/documentos. Normal logo após o cadastro.
                </p>
              )}
            </div>
          </div>
          <ApproveButtons motoboyId={d.id} name={d.fullName} />
        </div>
        );
      })}
    </>
  );
}
