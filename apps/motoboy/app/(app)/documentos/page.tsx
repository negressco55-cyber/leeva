import { requireMotoboyContext, adminDb } from '@/lib/context';
import { getDriverDocsStatus } from '@leeva/shared/services';
import { DocumentsForm } from './DocumentsForm';

export const dynamic = 'force-dynamic';

export default async function DocumentosPage() {
  const ctx = await requireMotoboyContext();
  const status = await getDriverDocsStatus(adminDb(), ctx.motoboyId);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>Meus dados</h1>
      <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>
        Mantenha seus dados e documentos em dia. O time do Leeva confere manualmente — pode levar até um dia útil.
      </p>
      <DocumentsForm initial={status} showProgress />
    </div>
  );
}
