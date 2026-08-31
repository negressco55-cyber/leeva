export default function SetupNotice() {
  return (
    <div className="screen">
      <h1>Leeva Motoboy</h1>
      <p className="muted">
        O app está no ar 🎉 — falta conectar o banco de dados (Supabase) para o login
        funcionar.
      </p>

      <div className="panel grid" style={{ marginTop: 16 }}>
        <strong>O que fazer (uma vez só)</strong>
        <ol className="muted" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li>
            Crie uma conta grátis em <a href="https://supabase.com">supabase.com</a> e um
            projeto novo.
          </li>
          <li>
            No <b>SQL Editor</b> do projeto, rode os 3 arquivos de{' '}
            <code>supabase/migrations/</code> (0001, 0002, 0003).
          </li>
          <li>
            Em <b>Project Settings → API</b>, copie as 3 chaves para{' '}
            <code>apps/restaurante/.env.local</code> e <code>apps/motoboy/.env.local</code>.
          </li>
          <li>Avise no chat que eu finalizo o resto.</li>
        </ol>
      </div>
    </div>
  );
}
