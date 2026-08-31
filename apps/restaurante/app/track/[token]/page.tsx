import { createLeevaAdminClient } from '@leeva/shared/server';
import { getPublicTrackingSnapshot } from '@leeva/shared/services';
import TrackingLive from './TrackingLive';
import './track.css';

export const dynamic = 'force-dynamic';

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = createLeevaAdminClient();
  const result = await getPublicTrackingSnapshot(db, token);

  if (!result.ok) {
    return (
      <div className="track-wrap">
        <div className="track-card">
          <h1>Link indisponível</h1>
          <p className="muted">{result.error}. Confira o link com o restaurante.</p>
        </div>
      </div>
    );
  }

  return <TrackingLive token={token} initial={result.snapshot} />;
}
