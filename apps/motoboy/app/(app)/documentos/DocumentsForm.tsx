'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle } from 'lucide-react';

type DocType = 'personal' | 'vehicle' | 'avatar';

type Status = { personalDocUrl: string | null; vehicleDocUrl: string | null; avatarUrl: string | null };

const META: Record<DocType, { title: string; hint: string; capture: 'environment' | 'user' }> = {
  personal: { title: 'CNH ou RG', hint: 'Uma foto legível do seu documento com CPF (CNH ou RG).', capture: 'environment' },
  vehicle: { title: 'CRLV do veículo', hint: 'Uma foto legível do documento do veículo (CRLV).', capture: 'environment' },
  avatar: { title: 'Foto do rosto', hint: 'Uma foto sua, de rosto, bem iluminada — aparece no seu perfil.', capture: 'user' },
};

const STATUS_KEY: Record<DocType, keyof Status> = {
  personal: 'personalDocUrl',
  vehicle: 'vehicleDocUrl',
  avatar: 'avatarUrl',
};

/** Redimensiona a foto no navegador antes de enviar (máx 1280px, JPEG ~0.7). */
function resizePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 1280;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('imagem inválida'));
    };
    img.src = url;
  });
}

function DocCard({
  type,
  url,
  onUploaded,
}: {
  type: DocType;
  url: string | null;
  onUploaded: (type: DocType, url: string) => void;
}) {
  const meta = META[type];
  const sent = !!url;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const dataUrl = await resizePhoto(file);
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, fileBase64: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'erro ao enviar');
      onUploaded(type, data[STATUS_KEY[type]]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível enviar. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 15 }}>{meta.title}</strong>
        <span className={`badge ${sent ? 'ok' : ''}`} style={!sent ? { background: 'var(--surface-2)', color: 'var(--muted)' } : undefined}>
          {sent ? <CheckCircle2 size={13} /> : <Circle size={13} />}
          {sent ? 'Enviado' : 'Pendente'}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>{meta.hint}</p>

      {sent && (
        <div style={{ marginBottom: 10, textAlign: type === 'avatar' ? 'center' : undefined }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={meta.title}
            style={
              type === 'avatar'
                ? { width: 84, height: 84, borderRadius: 999, objectFit: 'cover' }
                : { width: '100%', height: 140, borderRadius: 10, objectFit: 'cover', background: 'var(--surface-2)' }
            }
          />
        </div>
      )}

      {err && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 8px' }}>{err}</p>}

      <label className={`button ${sent ? 'secondary' : ''}`} style={{ textAlign: 'center', cursor: 'pointer', display: 'block' }}>
        {busy ? 'Enviando…' : sent ? 'Enviar outra foto' : 'Tirar foto'}
        <input type="file" accept="image/*" capture={meta.capture} hidden disabled={busy} onChange={(e) => onPick(e.target.files?.[0])} />
      </label>
    </div>
  );
}

export function DocumentsForm({ initial }: { initial: Status }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);

  function handleUploaded(type: DocType, url: string) {
    setStatus((s) => ({ ...s, [STATUS_KEY[type]]: url }));
    router.refresh();
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <DocCard type="personal" url={status.personalDocUrl} onUploaded={handleUploaded} />
      <DocCard type="vehicle" url={status.vehicleDocUrl} onUploaded={handleUploaded} />
      <DocCard type="avatar" url={status.avatarUrl} onUploaded={handleUploaded} />
    </div>
  );
}
