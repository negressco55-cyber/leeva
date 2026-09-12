'use client';

import { useEffect, useState } from 'react';

type Choice = 'system' | 'light' | 'dark';

export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>('system');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('leeva-theme');
      setChoice(stored === 'dark' || stored === 'light' ? stored : 'system');
    } catch {
      /* modo privado */
    }
  }, []);

  function cycle() {
    const next: Choice = choice === 'system' ? 'light' : choice === 'light' ? 'dark' : 'system';
    setChoice(next);
    try {
      if (next === 'system') localStorage.removeItem('leeva-theme');
      else localStorage.setItem('leeva-theme', next);
    } catch {
      /* modo privado */
    }
    if (next === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
  }

  const label = choice === 'system' ? 'Automático (do celular)' : choice === 'light' ? 'Claro' : 'Escuro';

  return (
    <button type="button" className="profile-row" onClick={cycle}>
      <span className="k">Aparência</span>
      <span className="v chev">{label}</span>
    </button>
  );
}
