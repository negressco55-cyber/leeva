import { requireRestaurantContext } from '@/lib/context';
import { ConnectMenu } from './ConnectMenu';
import { IfoodLink } from './IfoodLink';

export const dynamic = 'force-dynamic';

export default async function IntegracoesPage() {
  await requireRestaurantContext();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const deliveriesUrl = `${base}/api/v1/deliveries`;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Integrações</h1>
          <div className="sub">De onde chegam seus pedidos de entrega.</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Como um pedido chega no Leeva</div>
        <ul className="muted" style={{ fontSize: 13, lineHeight: 1.9, margin: 0, paddingLeft: 18 }}>
          <li><b>Digitando no painel</b> — aba Pedidos → Nova entrega. Serve pra qualquer um.</li>
          <li><b>Do seu cardápio digital / PDV / site</b> — pela chave de conexão (abaixo). Cobre a maioria das plataformas.</li>
          <li><b>Por WhatsApp</b> — a IA lê a mensagem do cliente e monta o pedido pra você confirmar.</li>
          <li><b>Do iFood</b> — conector próprio (abaixo), depende da homologação do iFood.</li>
        </ul>
      </div>

      <ConnectMenu deliveriesUrl={deliveriesUrl} />

      <IfoodLink />
    </div>
  );
}
