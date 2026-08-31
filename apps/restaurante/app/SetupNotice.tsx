export default function SetupNotice() {
  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <h1>Leeva Restaurante</h1>
      <p className="muted">
        O site está no ar 🎉 — falta só conectar o banco de dados (Supabase) para o login
        funcionar.
      </p>

      <div className="panel grid" style={{ marginTop: 16 }}>
        <strong>Passo a passo (uma vez só, ~5 min)</strong>
        <ol className="muted" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li>
            Crie uma conta grátis em <a href="https://supabase.com">supabase.com</a> e um
            novo projeto.
          </li>
          <li>
            No projeto: menu <b>SQL Editor</b> → cole e rode, nesta ordem, os 3 arquivos da
            pasta <code>supabase/migrations/</code> (0001, 0002, 0003).
          </li>
          <li>
            Menu <b>Project Settings → API</b>: copie <code>Project URL</code>,{' '}
            <code>anon public</code> e <code>service_role</code>.
          </li>
          <li>
            Cole esses valores nos arquivos <code>apps/restaurante/.env.local</code> e{' '}
            <code>apps/motoboy/.env.local</code>.
          </li>
          <li>Me avise aqui no chat que eu finalizo (rodo os testes e os dados de exemplo).</li>
        </ol>
        <p className="muted">
          Detalhes completos em <code>README.md</code> e <code>supabase/README.md</code>.
        </p>
      </div>
    </div>
  );
}
