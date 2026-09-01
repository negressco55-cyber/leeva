import React, { createContext, useContext, useMemo, useRef, useState } from 'react';

export type LatLng = { latitude: number; longitude: number };

interface PositionContextValue {
  position: LatLng | null;
  setPosition: (p: LatLng | null) => void;
}

const PositionContext = createContext<PositionContextValue | undefined>(undefined);

/**
 * A posição do GPS muda com frequência. Fica num contexto separado do
 * RideContext para que uma nova leitura NÃO faça a tela toda re-renderizar
 * — só quem chama usePosition() (o mapa) reage.
 */
export function PositionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [position, setPositionState] = useState<LatLng | null>(null);
  const lastRef = useRef<LatLng | null>(null);

  const setPosition = useRef((p: LatLng | null) => {
    // ignora atualizações irrelevantes (< ~8 m) para não re-renderizar à toa
    const prev = lastRef.current;
    if (p && prev) {
      const dLat = Math.abs(p.latitude - prev.latitude);
      const dLng = Math.abs(p.longitude - prev.longitude);
      if (dLat < 0.00007 && dLng < 0.00007) return;
    }
    lastRef.current = p;
    setPositionState(p);
  }).current;

  const value = useMemo(() => ({ position, setPosition }), [position, setPosition]);
  return <PositionContext.Provider value={value}>{children}</PositionContext.Provider>;
}

export function usePosition(): PositionContextValue {
  const ctx = useContext(PositionContext);
  if (!ctx) throw new Error('usePosition precisa estar dentro de PositionProvider');
  return ctx;
}
