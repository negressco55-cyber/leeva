import Link from 'next/link';
import styles from './landing.module.css';

/**
 * Página pública de venda do Leeva para comércios (raiz para quem não está
 * logado e /lojistas). Só promete o que o produto já faz hoje.
 * Valores: entregador R$ 2,00/km, mínimo R$ 5,00 (payout_policies) + margem
 * do plano Livre R$ 1,00 por entrega. Se mudar lá, mude aqui.
 */

const PER_KM = 2;
const MIN_PAYOUT = 5;
const LEEVA_FEE = 1;

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const courier = (km: number) => Math.max(km * PER_KM, MIN_PAYOUT);

const EXAMPLES = [1.5, 3, 5, 8];

const STEPS = [
  {
    title: 'Você cria a entrega',
    body: 'Nome, telefone e endereço do cliente. O Leeva localiza no mapa e mostra quanto vai custar antes de você confirmar.',
  },
  {
    title: 'O entregador mais perto é chamado',
    body: 'O sistema escolhe sozinho quem está mais perto e com a rota mais livre. Se ele recusar, a oferta vai para o próximo — você não precisa ligar para ninguém.',
  },
  {
    title: 'Você e o cliente acompanham',
    body: 'O pedido aparece no seu painel com o entregador, a foto dele e o tempo estimado. O cliente recebe um link para acompanhar a entrega.',
  },
  {
    title: 'A entrega é confirmada com código',
    body: 'O cliente passa um código de 4 dígitos para o entregador. Pedidos do iFood fecham com o localizador do próprio iFood.',
  },
];

const FEATURES = [
  { title: 'Despacho automático', body: 'Ninguém da sua equipe precisa escolher entregador. O Leeva chama e, se não aceitarem, tenta o próximo.' },
  { title: 'Preço antes de confirmar', body: 'A taxa é calculada pela distância real e aparece antes de você criar a entrega. Sem surpresa no fim do mês.' },
  { title: 'Rastreio para o cliente', body: 'Link de acompanhamento sem precisar baixar nada. Menos cliente ligando para perguntar onde está o pedido.' },
  { title: 'Chat e WhatsApp do entregador', body: 'Fale com quem está levando o pedido direto pelo painel.' },
  { title: 'Entregadores favoritos', body: 'Marque quem atende bem sua loja para ele receber suas corridas primeiro. E bloqueie quem você não quer de volta.' },
  { title: 'Pedidos do iFood', body: 'Lance o pedido com o localizador do iFood e use os entregadores do Leeva no lugar da entrega do app.' },
  { title: 'Crédito por Pix', body: 'Você recarrega o saldo por Pix e cada entrega desconta do crédito. Controle de tudo no extrato.' },
  { title: 'Seus próprios motoboys', body: 'Já tem entregador fixo? Cadastre sua equipe e use a rede do Leeva só no pico ou quando faltar gente.' },
];

const FAQ = [
  {
    q: 'Tem mensalidade ou fidelidade?',
    a: 'Não. Você paga só as entregas que fizer: o valor do entregador mais R$ 1,00 do Leeva por entrega. Pode parar de usar quando quiser.',
  },
  {
    q: 'Como eu pago?',
    a: 'Você recarrega crédito por Pix dentro do painel e cada entrega é descontada do saldo. O banco cobra R$ 0,99 por recarga.',
  },
  {
    q: 'E se nenhum entregador aceitar?',
    a: 'A oferta passa automaticamente para o próximo entregador disponível. Se ninguém puder, o painel te avisa na hora para você decidir o que fazer.',
  },
  {
    q: 'Preciso instalar alguma coisa?',
    a: 'Não. O painel funciona no navegador do computador ou do celular. Quem usa aplicativo é o entregador.',
  },
  {
    q: 'Onde o Leeva funciona?',
    a: 'Em João Pessoa. Estamos começando pela região do Planalto da Boa Esperança, Valentina e bairros vizinhos, onde temos mais entregadores.',
  },
];

function Mark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 2.5a7 7 0 0 0-7 7c0 5.2 7 12 7 12s7-6.8 7-12a7 7 0 0 0-7-7z" fill="var(--brand)" />
      <circle cx="12" cy="9.5" r="2.6" fill="var(--surface)" />
    </svg>
  );
}

/** Ilustração do painel — espelha o card real de um pedido em andamento. */
function OrderPreview() {
  return (
    <div className={styles.preview} role="img" aria-label="Exemplo de pedido em andamento no painel do Leeva">
      <div className={styles.previewHead}>
        <span className={styles.previewTitle}>Pedido #128 · Maria S.</span>
        <span className={styles.tag}>A caminho</span>
      </div>
      <svg className={styles.route} viewBox="0 0 320 110" aria-hidden="true">
        <path d="M30 80 C 90 80, 110 30, 170 42 S 250 70, 292 28" fill="none" stroke="var(--brand-line)" strokeWidth="4" strokeLinecap="round" />
        <path d="M30 80 C 90 80, 110 30, 170 42" fill="none" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="30" cy="80" r="7" fill="var(--text)" />
        <circle cx="170" cy="42" r="9" fill="var(--brand)" stroke="var(--surface)" strokeWidth="3" />
        <circle cx="292" cy="28" r="7" fill="var(--surface)" stroke="var(--brand)" strokeWidth="3" />
      </svg>
      <dl className={styles.previewGrid}>
        <div>
          <dt>Entregador</dt>
          <dd>João · CG 160</dd>
        </div>
        <div>
          <dt>Chega em</dt>
          <dd>6–9 min</dd>
        </div>
        <div>
          <dt>Distância</dt>
          <dd>2,8 km</dd>
        </div>
        <div>
          <dt>Custo total</dt>
          <dd>{brl(courier(2.8) + LEEVA_FEE)}</dd>
        </div>
      </dl>
      <div className={styles.previewCode}>
        <span>Código de entrega</span>
        <strong>4 8 2 1</strong>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className={styles.brand}>
          <Mark />
          Leeva
        </Link>
        <nav className={styles.navLinks} aria-label="Seções">
          <a href="#como-funciona">Como funciona</a>
          <a href="#precos">Preços</a>
          <a href="#duvidas">Dúvidas</a>
        </nav>
        <div className={styles.navCta}>
          <Link href="/login" className={styles.linkQuiet}>
            Entrar
          </Link>
          <Link href="/signup" className={styles.btn}>
            Criar conta
          </Link>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Entregas para comércios em João Pessoa</p>
            <h1 className={styles.h1}>Você cria a entrega. O entregador mais perto chega sozinho.</h1>
            <p className={styles.lead}>
              O Leeva chama o motoboy, acompanha a rota e avisa o cliente. Sem mensalidade: você paga só as entregas que
              fizer.
            </p>
            <div className={styles.heroActions}>
              <Link href="/signup" className={`${styles.btn} ${styles.btnLg}`}>
                Criar conta grátis
              </Link>
              <a href="#precos" className={`${styles.btnSecondary} ${styles.btnLg}`}>
                Ver preços
              </a>
            </div>
            <p className={styles.small}>Cadastro em poucos minutos. Sem cartão de crédito.</p>
          </div>
          <OrderPreview />
        </section>

        <section id="como-funciona" className={styles.section}>
          <h2 className={styles.h2}>Como funciona</h2>
          <ol className={styles.steps}>
            {STEPS.map((s, i) => (
              <li key={s.title} className={styles.step}>
                <span className={styles.stepNum}>{i + 1}</span>
                <div>
                  <h3 className={styles.h3}>{s.title}</h3>
                  <p className={styles.body}>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${styles.section} ${styles.sectionSunk}`}>
          <h2 className={styles.h2}>O que vem junto</h2>
          <div className={styles.features}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.feature}>
                <h3 className={styles.h3}>{f.title}</h3>
                <p className={styles.body}>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="precos" className={styles.section}>
          <div className={styles.priceIntro}>
            <h2 className={styles.h2}>Preço por entrega, sem mensalidade</h2>
            <p className={styles.lead}>
              Cada entrega custa o valor do entregador pela distância mais <strong>{brl(LEEVA_FEE)}</strong> do Leeva. Nada
              de taxa fixa, fidelidade ou porcentagem sobre a sua venda.
            </p>
          </div>

          <div className={styles.priceWrap}>
            <div className={styles.formula}>
              <div>
                <span className={styles.formulaLabel}>Entregador</span>
                <strong>{brl(PER_KM)} por km</strong>
                <span className={styles.formulaNote}>mínimo de {brl(MIN_PAYOUT)}</span>
              </div>
              <span className={styles.plus} aria-hidden="true">+</span>
              <div>
                <span className={styles.formulaLabel}>Leeva</span>
                <strong>{brl(LEEVA_FEE)} por entrega</strong>
                <span className={styles.formulaNote}>sem mensalidade</span>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className={styles.caption}>Exemplos de custo total por entrega</caption>
                <thead>
                  <tr>
                    <th scope="col">Distância</th>
                    <th scope="col">Entregador</th>
                    <th scope="col">Leeva</th>
                    <th scope="col">Você paga</th>
                  </tr>
                </thead>
                <tbody>
                  {EXAMPLES.map((km) => (
                    <tr key={km}>
                      <td>{km.toLocaleString('pt-BR')} km</td>
                      <td>{brl(courier(km))}</td>
                      <td>{brl(LEEVA_FEE)}</td>
                      <td className={styles.total}>{brl(courier(km) + LEEVA_FEE)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className={styles.small}>
            A distância é a do trajeto de rua entre a sua loja e o cliente. O valor aparece antes de você confirmar cada
            entrega. O pagamento é por crédito pré-pago via Pix.
          </p>
        </section>

        <section className={`${styles.section} ${styles.sectionSunk}`}>
          <h2 className={styles.h2}>Comparando com o que você usa hoje</h2>
          <div className={styles.compare}>
            <div>
              <h3 className={styles.h3}>Motoboy fixo</h3>
              <p className={styles.body}>Salário e diária mesmo nos dias fracos. Quando falta, a loja para.</p>
            </div>
            <div>
              <h3 className={styles.h3}>Comissão por pedido</h3>
              <p className={styles.body}>Uma porcentagem de cada venda vai embora, até dos pedidos grandes.</p>
            </div>
            <div className={styles.compareLeeva}>
              <h3 className={styles.h3}>Leeva</h3>
              <p className={styles.body}>Você paga só a entrega feita, pelo valor da distância. Dia parado, custo zero.</p>
            </div>
          </div>
        </section>

        <section id="duvidas" className={styles.section}>
          <h2 className={styles.h2}>Dúvidas</h2>
          <div className={styles.faq}>
            {FAQ.map((f) => (
              <details key={f.q} className={styles.faqItem}>
                <summary>{f.q}</summary>
                <p className={styles.body}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.final}>
          <h2 className={styles.h2}>Faça sua primeira entrega hoje</h2>
          <p className={styles.lead}>Crie a conta, recarregue o crédito e mande o primeiro pedido.</p>
          <Link href="/signup" className={`${styles.btn} ${styles.btnLg}`}>
            Criar conta grátis
          </Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.brand}>
          <Mark />
          Leeva
        </span>
        <span>Logística de entregas para comércios · João Pessoa, PB</span>
        <span className={styles.footerLinks}>
          <Link href="/login">Entrar</Link>
          <a href="https://leeva-motoboy.vercel.app/quero-entregar">Quero ser entregador</a>
        </span>
      </footer>
    </div>
  );
}
