'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../_lib/client';

type Pkg = { id: string; amount: number; bonus: number; label: string | null; sort_order: number; active: boolean };

export function PackagesEditor({ initial }: { initial: Pkg[] }) {
  const router = useRouter();
  const [pkgs, setPkgs] = useState<Pkg[]>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const upd = (i: number, p: Partial<Pkg>) => setPkgs((x) => x.map((e, idx) => (idx === i ? { ...e, ...p } : e)));

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await apiPost('/api/credit-packages', { packages: pkgs });
      setMsg('Pacotes salvos.');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'erro');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Pacotes de crédito à venda</div>
      <table className="tbl">
        <thead><tr><th>Valor (R$)</th><th>Bônus (R$)</th><th>Rótulo</th><th>Ordem</th><th>Ativo</th></tr></thead>
        <tbody>
          {pkgs.map((p, i) => (
            <tr key={p.id}>
              <td><input className="input" type="number" step="1" value={p.amount} onChange={(e) => upd(i, { amount: Number(e.target.value) })} style={{ width: 90 }} /></td>
              <td><input className="input" type="number" step="1" value={p.bonus} onChange={(e) => upd(i, { bonus: Number(e.target.value) })} style={{ width: 90 }} /></td>
              <td><input className="input" value={p.label ?? ''} onChange={(e) => upd(i, { label: e.target.value })} style={{ width: 160 }} /></td>
              <td><input className="input" type="number" value={p.sort_order} onChange={(e) => upd(i, { sort_order: Number(e.target.value) })} style={{ width: 60 }} /></td>
              <td><input type="checkbox" checked={p.active} onChange={(e) => upd(i, { active: e.target.checked })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {msg && <div className="op-alert ok" style={{ marginTop: 8 }}>{msg}</div>}
      <button className="btn" onClick={save} disabled={saving} style={{ marginTop: 10 }}>{saving ? 'Salvando…' : 'Salvar pacotes'}</button>
    </div>
  );
}
