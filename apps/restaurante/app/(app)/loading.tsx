/**
 * Esqueleto exibido instantaneamente enquanto o server component da rota
 * carrega. Sem isto, o Next bloqueia a navegação e a tela "trava" até os
 * dados chegarem — com isto, o clique responde na hora.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="page-head">
        <div className="skeleton sk-title" />
      </div>
      <div className="skeleton sk-line" style={{ width: '40%' }} />
      <div className="skeleton sk-card" />
      <div className="skeleton sk-card" />
      <div className="skeleton sk-card" />
    </div>
  );
}
