'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle } from 'lucide-react';

type DocType = 'personal' | 'personal_back' | 'vehicle' | 'avatar';

type Status = {
  personalDocUrl: string | null;
  personalDocBackUrl: string | null;
  vehicleDocUrl: string | null;
  avatarUrl: string | null;
};

const META: Record<DocType, { title: string; hint: string; capture: 'environment' | 'user' | undefined; accept: string }> = {
  personal: { title: 'CNH ou RG — frente', hint: 'Uma foto legível da frente do seu documento com CPF (CNH ou RG).', capture: 'environment', accept: 'image/*' },
  personal_back: { title: 'CNH ou RG — verso', hint: 'Uma foto legível do verso do documento.', capture: 'environment', accept: 'image/*' },
  vehicle: { title: 'CRLV do veículo', hint: 'Uma foto ou o PDF do CRLV.', capture: undefined, accept: 'image/*,application/pdf' },
  avatar: { title: 'Foto do rosto', hint: 'Uma foto sua, de rosto, bem iluminada — aparece no seu perfil.', capture: 'user', accept: 'image/*' },
};

/** Lê um arquivo (PDF) como data URL, sem redimensionar. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('arquivo inválido'));
    reader.readAsDataURL(file);
  });
}

const STATUS_KEY: Record<DocType, keyof Status> = {
  personal: 'personalDocUrl',
  personal_back: 'personalDocBackUrl',
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
  const isPdf = sent && /\.pdf(\?|$)/i.test(url);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      if (file.type === 'application/pdf' && file.size > 3.5 * 1024 * 1024) {
        throw new Error('PDF muito grande — envie até 3,5 MB.');
      }
      const dataUrl = file.type === 'application/pdf' ? await readAsDataUrl(file) : await resizePhoto(file);
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, fileBase64: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'erro ao enviar');
      onUploaded(type, data[STATUS_KEY[type]]);
      if (data.requiresReview) {
        setNotice('Como você já estava aprovado, esse documento precisa passar por uma nova revisão antes de você voltar a receber ofertas.');
      }
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
          {isPdf ? (
            <a href={url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 60, borderRadius: 10, background: 'var(--surface-2)', padding: '0 14px', color: 'var(--text)', textDecoration: 'none', fontSize: 13 }}>
              📄 PDF enviado — ver arquivo
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={meta.title}
              style={
                type === 'avatar'
                  ? { width: 84, height: 84, borderRadius: 999, objectFit: 'cover' }
                  : { width: '100%', height: 140, borderRadius: 10, objectFit: 'cover', background: 'var(--surface-2)' }
              }
            />
          )}
        </div>
      )}

      {err && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 8px' }}>{err}</p>}
      {notice && <p style={{ color: 'var(--warn)', fontSize: 13, margin: '0 0 8px' }}>{notice}</p>}

      <label className={`button ${sent ? 'secondary' : ''}`} style={{ textAlign: 'center', cursor: 'pointer', display: 'block' }}>
        {busy ? 'Enviando…' : sent ? 'Enviar outra foto' : meta.accept.includes('pdf') ? 'Tirar foto ou enviar PDF' : 'Tirar foto'}
        <input type="file" accept={meta.accept} capture={meta.capture} hidden disabled={busy} onChange={(e) => onPick(e.target.files?.[0])} />
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
      <DocCard type="personal_back" url={status.personalDocBackUrl} onUploaded={handleUploaded} />
      <DocCard type="vehicle" url={status.vehicleDocUrl} onUploaded={handleUploaded} />
      <DocCard type="avatar" url={status.avatarUrl} onUploaded={handleUploaded} />
    </div>
  );
}
