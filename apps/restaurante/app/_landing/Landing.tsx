import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './landing.module.css';
import SavingsCalculator from './SavingsCalculator';
import LandingFx from './LandingFx';
import { body, display, mono } from './fonts';

/**
 * Página pública de venda do Leeva para comércios (raiz para visitantes e
 * /lojistas). Segue o modelo visual da landing da Farol, a pedido da dona.
 * Só promete o que o produto já faz hoje.
 *
 * Valores: entregador R$ 2,00/km, mínimo R$ 5,00 (payout_policies) + margem
 * do plano Livre R$ 1,00 por entrega. Se mudar lá, mude aqui. A página mostra
 * só o TOTAL por entrega — a divisão entregador/Leeva não é exibida.
 */

const PER_KM = 2;
const MIN_PAYOUT = 5;
const LEEVA_FEE = 1;

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const total = (km: number) => Math.max(km * PER_KM, MIN_PAYOUT) + LEEVA_FEE;

const EXAMPLES = [1.5, 3, 5, 8];
const CADASTRO_ENTREGADOR = 'https://leeva-motoboy.vercel.app/quero-entregar';

const FRASES: { t: ReactNode; s: string }[] = [
  { t: <>Motoboy faltou? <em>O Leeva acha outro.</em></>, s: 'Se um entregador recusa, a corrida vai sozinha para o próximo mais perto.' },
  { t: <>Sem mensalidade. <em>Paga só a entrega.</em></>, s: 'Dia parado, custo zero. Nada de diária para motoboy esperando pedido.' },
  { t: <>Você vê o preço <em>antes</em> de confirmar.</>, s: 'O valor é calculado pela distância e aparece antes de você criar a entrega.' },
  { t: <>Cliente acompanha <em>sem baixar nada</em>.</>, s: 'Mande o link de rastreio pelo WhatsApp e ele vê o entregador chegando.' },
  { t: <>Entrega confirmada com <em>código</em>.</>, s: 'O cliente passa 4 dígitos ao entregador. Pedido do iFood fecha com o localizador.' },
  { t: <>Quem atende bem, <em>volta sempre</em>.</>, s: 'Marque seus entregadores favoritos e eles recebem suas corridas primeiro.' },
];

const PASSOS = [
  { t: 'Você cria a entrega', d: 'Nome, telefone e endereço do cliente. Confira o ponto no mapa e veja o valor antes de confirmar.', ic: 'M4 7h16M4 12h10M4 17h7M17 15l2 2 4-4' },
  { t: 'O mais perto é chamado', d: 'O Leeva escolhe quem está mais perto e com a rota mais livre. Recusou? Vai pro próximo.', ic: 'M12 3a6 6 0 0 1 6 6c0 4.5-6 12-6 12S6 13.5 6 9a6 6 0 0 1 6-6Zm0 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z' },
  { t: 'Todo mundo acompanha', d: 'Você vê entregador, foto e tempo no painel. O cliente acompanha pelo link.', ic: 'M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Zm9-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z' },
  { t: 'Entregue com código', d: 'O cliente passa 4 dígitos, o entregador confirma e o pedido fecha sozinho.', ic: 'M5 12.5 9.2 16.7 19 7' },
];

const RECURSOS: { t: string; d: string; meta: string; dif?: boolean }[] = [
  { t: 'Despacho automático', d: 'Ninguém da sua equipe escolhe entregador. O Leeva chama o mais perto e, se ele não aceitar, tenta o próximo.', meta: 'chama em segundos', dif: true },
  { t: 'Preço antes de confirmar', d: 'Calculado pela distância real. Sem surpresa no fim do mês.', meta: 'a partir de R$ 6', dif: true },
  { t: 'Rastreio para o cliente', d: 'Link de acompanhamento sem precisar baixar nada. Menos cliente ligando pra perguntar do pedido.', meta: 'link no WhatsApp' },
  { t: 'Chat com o entregador', d: 'Fale com quem está levando o pedido direto do painel, ou chame no WhatsApp dele.', meta: 'chat · WhatsApp' },
  { t: 'Entregadores favoritos', d: 'Quem atende bem sua loja recebe suas corridas primeiro. E quem você bloqueia não volta.', meta: 'favoritar · bloquear' },
  { t: 'Pedidos do iFood', d: 'Lance o pedido com o localizador do iFood e use os entregadores do Leeva no lugar da entrega do app.', meta: 'localizador iFood' },
  { t: 'Seus próprios motoboys', d: 'Já tem entregador fixo? Cadastre sua equipe e use a rede do Leeva só no pico ou quando faltar gente.', meta: 'frota própria + rede' },
  { t: 'Crédito por Pix', d: 'Recarregue o saldo por Pix e cada entrega desconta do crédito. Tudo no extrato.', meta: 'Pix' },
];

const FAQ = [
  { q: 'Tem mensalidade ou fidelidade?', a: 'Não. Você paga só as entregas que fizer, pelo valor calculado pela distância. Pode parar de usar quando quiser.' },
  { q: 'Como eu pago?', a: 'Você recarrega crédito por Pix dentro do painel e cada entrega é descontada do saldo. O banco cobra R$ 0,99 por recarga.' },
  { q: 'E se nenhum entregador aceitar?', a: 'A oferta passa automaticamente para o próximo disponível. Se ninguém puder, o painel te avisa na hora para você decidir o que fazer.' },
  { q: 'Preciso instalar alguma coisa?', a: 'Não. O painel funciona no navegador do computador ou do celular. Quem usa aplicativo é o entregador.' },
  { q: 'Onde o Leeva funciona?', a: 'Em João Pessoa. Estamos começando pela região do Planalto da Boa Esperança, Valentina e bairros vizinhos, onde temos mais entregadores.' },
];

function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5a7 7 0 0 0-7 7c0 5.2 7 12 7 12s7-6.8 7-12a7 7 0 0 0-7-7z" fill="currentColor" />
      <circle cx="12" cy="9.5" r="2.6" fill="var(--ground)" />
    </svg>
  );
}

/** Painel de exemplo do hero: a moto percorre a rota da loja até o cliente. */
function Painel() {
  const rota = 'M40 150 C 90 150, 95 95, 150 92 S 215 60, 238 58 S 300 34, 318 28';
  return (
    <div className={styles.painel} role="img" aria-label="Exemplo do painel do Leeva: entregador a caminho do cliente, com rota, tempo, distância, custo e código de entrega">
      <div className={styles.painelTop}>
        <b>Pedido #128 · Maria S.</b>
        <span className={`${styles.chip} ${styles.vivo}`}>ao vivo</span>
      </div>
      <svg className={styles.mapa} viewBox="0 0 360 180" aria-hidden="true">
        <g className={styles.ruas}>
          <path d="M0 40H360M0 100H360M0 160H360M60 0V180M150 0V180M250 0V180M320 0V180" />
          <path d="M0 130 L120 10M180 180 L360 60" />
        </g>
        <path d={rota} className={styles.rotaFundo} />
        <path d={rota} className={styles.rotaFeita} pathLength={100} />
        <g className={styles.loja}>
          <circle cx="40" cy="150" r="16" className={styles.radar} />
          <circle cx="40" cy="150" r="7" />
        </g>
        <g className={styles.cliente}>
          <circle cx="318" cy="28" r="8" />
        </g>
        <g className={styles.moto}>
          <circle r="10" />
          <path d="M-4 1h5l1.6-3.4M-3.5-2.5h2.5" />
          <animateMotion dur="7s" repeatCount="indefinite" path={rota} keyTimes="0;0.85;1" keyPoints="0;1;1" calcMode="linear" />
        </g>
      </svg>
      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <small>Entregador</small>
          <strong>João</strong>
          <span className={styles.d}>CG 160 · ★ 4,9</span>
        </div>
        <div className={styles.kpi}>
          <small>Chega em</small>
          <strong>6 min</strong>
          <span className={styles.d}>2,8 km</span>
        </div>
        <div className={styles.kpi}>
          <small>Custo total</small>
          <strong>{brl(total(2.8))}</strong>
          <span className={styles.d}>sem mensalidade</span>
        </div>
      </div>
      <div className={styles.codigo}>
        <span>Código de entrega</span>
        <strong>4 8 2 1</strong>
      </div>
      <p className={styles.legenda}>Exemplo do painel que o restaurante acompanha</p>
    </div>
  );
}

export default function Landing() {
  return (
    <div className={`${styles.page} ${display.variable} ${body.variable} ${mono.variable}`} data-landing>
      <header className={styles.top}>
        <div className={styles.wrap}>
          <Link href="/" className={styles.logo} aria-label="Leeva, início">
            <Mark />
            leeva
          </Link>
          <nav className={styles.nav} aria-label="Seções">
            <a href="#como-funciona">Como funciona</a>
            <a href="#demo">Na prática</a>
            <a href="#precos">Preços</a>
            <a href="#entregadores">Entregadores</a>
            <a href="#duvidas">Dúvidas</a>
          </nav>
          <div className={styles.topCta}>
            <Link href="/login" className={styles.entrar}>
              Entrar
            </Link>
            <Link href="/signup" className={`${styles.btn} ${styles.btnVerde}`}>
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <svg className={styles.trilhas} viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <path d="M-50 560 C 200 520, 260 380, 470 360 S 760 300, 900 180 S 1150 90, 1260 60" />
            <path d="M-50 300 C 180 330, 330 220, 520 250 S 820 420, 1260 380" />
            <path d="M200 760 C 260 560, 420 520, 600 560 S 900 700, 1000 760" />
          </svg>
          <div className={`${styles.wrap} ${styles.heroGrid}`}>
            <div>
              <p className={styles.eyebrow}>Entregas para comércios · João Pessoa</p>
              <h1 className={styles.h1}>
                Você cria a entrega. O motoboy mais perto <em>chega sozinho.</em>
              </h1>
              <p className={styles.lead}>
                O Leeva chama o entregador, acompanha a rota e fecha a entrega com código. Sem mensalidade: você paga só as
                entregas que fizer.
              </p>
              <div className={styles.ctas}>
                <Link href="/signup" className={`${styles.btn} ${styles.btnVerde} ${styles.pulsa}`}>
                  Criar conta grátis
                </Link>
                <a href="#precos" className={`${styles.btn} ${styles.btnGhost}`}>
                  Ver preços
                </a>
              </div>
              <p className={styles.ctasNote}>
                Cadastro em poucos minutos, sem cartão de crédito. É entregador?{' '}
                <a href={CADASTRO_ENTREGADOR}>Cadastre-se aqui</a>.
              </p>
            </div>
            <Painel />
          </div>
        </section>

        <div className={styles.faixa} aria-label="Por que o Leeva">
          <div className={styles.trilho}>
            {[0, 1].map((k) => (
              <ul key={k} aria-hidden={k === 1 ? true : undefined}>
                {FRASES.map((f, i) => (
                  <li key={i}>
                    <strong>{f.t}</strong>
                    <span>{f.s}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>

        <section className={styles.sec}>
          <div className={styles.wrap}>
            <div className={`${styles.secHead} ${styles.revela}`} data-revela>
              <p className={styles.eyebrow}>Se você se reconhece aqui</p>
              <h2 className={styles.h2}>O problema não é a sua cozinha. É a entrega.</h2>
            </div>
            <div className={styles.dores}>
              <div className={`${styles.dor} ${styles.revela}`} data-revela>
                <span className={styles.q} aria-hidden="true">“</span>
                <h3 className={styles.h3}>O motoboy faltou bem no pico.</h3>
                <p>Com um entregador só, qualquer imprevisto trava a loja. No Leeva, a rede de entregadores da região cobre na hora.</p>
              </div>
              <div className={`${styles.dor} ${styles.revela}`} data-revela>
                <span className={styles.q} aria-hidden="true">“</span>
                <h3 className={styles.h3}>Pago diária até em dia fraco.</h3>
                <p>Motoboy fixo custa o mesmo com 3 ou 30 pedidos. Aqui você paga por entrega feita, e o valor aparece antes.</p>
              </div>
              <div className={`${styles.dor} ${styles.revela}`} data-revela>
                <span className={styles.q} aria-hidden="true">“</span>
                <h3 className={styles.h3}>O cliente liga cinco vezes: “cadê meu pedido?”</h3>
                <p>Mande o link de rastreio e ele acompanha o entregador chegando. Sua equipe volta a cuidar da cozinha.</p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.sec} id="como-funciona">
          <div className={styles.wrap}>
            <div className={`${styles.secHead} ${styles.centro} ${styles.revela}`} data-revela>
              <p className={styles.eyebrow}>Como funciona</p>
              <h2 className={styles.h2}>Do pedido à porta do cliente, sem você ligar pra ninguém.</h2>
            </div>
            <ol className={`${styles.passos} ${styles.revela}`} data-revela data-linha>
              {PASSOS.map((p) => (
                <li key={p.t} className={styles.passo}>
                  <span className={styles.ic}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d={p.ic} />
                    </svg>
                  </span>
                  <h3 className={styles.h3}>{p.t}</h3>
                  <p>{p.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={`${styles.sec} ${styles.demo}`} id="demo">
          <div className={`${styles.wrap} ${styles.demoGrid}`}>
            <div>
              <div className={`${styles.secHead} ${styles.revela}`} data-revela style={{ marginBottom: 0 }}>
                <p className={styles.eyebrow}>Na prática</p>
                <h2 className={styles.h2}>Uma entrega inteira em menos de meia hora. Você só criou o pedido.</h2>
                <p className={styles.lead}>É assim que o pedido anda no seu painel, do momento em que você confirma até o código ser conferido.</p>
              </div>
              <ul className={styles.pontos}>
                <li><Check /><span><b>Nada de grupo de motoboy</b> no WhatsApp pra achar quem pega.</span></li>
                <li><Check /><span><b>Tudo registrado:</b> quem levou, que horas saiu, que horas chegou.</span></li>
                <li><Check /><span><b>Confirmação por código</b>, pra entrega não ser dada como feita sem ter chegado.</span></li>
              </ul>
            </div>
            <div className={styles.celular} role="img" aria-label="Demonstração: uma entrega andando no painel do Leeva, da criação até a confirmação com código">
              <div className={styles.tela}>
                <div className={styles.entalhe} aria-hidden="true" />
                <div className={styles.appTopo}>
                  <span className={styles.av}><Mark /></span>
                  <div>
                    <b>Doceria da Maria</b>
                    <small data-demo-status>1 entrega em andamento</small>
                  </div>
                </div>
                <div className={styles.eventos} data-demo aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.sec} ${styles.recursos}`}>
          <div className={`${styles.wrap} ${styles.recursosGrid}`}>
            <div className={`${styles.secHead} ${styles.fixo} ${styles.revela}`} data-revela>
              <p className={styles.eyebrow}>O que vem junto</p>
              <h2 className={styles.h2}>Não é só um motoboy. É a entrega inteira organizada.</h2>
              <p className={styles.lead}>Os itens em destaque são o que faz o Leeva diferente de chamar alguém num grupo.</p>
              <Link href="/signup" className={`${styles.btn} ${styles.btnVerde}`}>
                Quero isso na minha loja
              </Link>
            </div>
            <ul className={styles.lista}>
              {RECURSOS.map((r) => (
                <li key={r.t} className={`${styles.item} ${r.dif ? styles.dif : ''} ${styles.revela}`} data-revela>
                  <div>
                    {r.dif && <span className={styles.rot}>Diferencial</span>}
                    <h3 className={styles.itemTitulo}>{r.t}</h3>
                    <p>{r.d}</p>
                  </div>
                  <span className={styles.meta}>
                    {r.dif && <i />}
                    {r.meta}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.sec} id="precos">
          <div className={styles.wrap}>
            <div className={`${styles.secHead} ${styles.revela}`} data-revela>
              <p className={styles.eyebrow}>Preço</p>
              <h2 className={styles.h2}>Por entrega. Sem mensalidade, sem fidelidade.</h2>
              <p className={styles.lead}>
                Cada entrega tem um valor calculado pela distância, e ele aparece antes de você confirmar. Nada de taxa fixa ou
                porcentagem sobre a sua venda.
              </p>
            </div>
            <div className={styles.precoGrid}>
              <div className={`${styles.precoCard} ${styles.revela}`} data-revela>
                <small>Entregas a partir de</small>
                <strong>{brl(total(0))}</strong>
                <span>tudo incluso · pago com crédito via Pix</span>
              </div>
              <div className={`${styles.tabelaWrap} ${styles.revela}`} data-revela>
                <table className={styles.tabela}>
                  <caption>Exemplos de custo por entrega</caption>
                  <thead>
                    <tr>
                      <th scope="col">Distância até o cliente</th>
                      <th scope="col">Você paga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EXAMPLES.map((km) => (
                      <tr key={km}>
                        <td>{km.toLocaleString('pt-BR')} km</td>
                        <td>{brl(total(km))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className={styles.revela} data-revela>
              <SavingsCalculator perKm={PER_KM} minPayout={MIN_PAYOUT} fee={LEEVA_FEE} />
            </div>
          </div>
        </section>

        <section className={`${styles.sec} ${styles.fundo}`} id="entregadores">
          <div className={`${styles.wrap} ${styles.split}`}>
            <div className={`${styles.secHead} ${styles.revela}`} data-revela>
              <p className={styles.eyebrow}>Para entregadores</p>
              <h2 className={styles.h2}>Rode pelo Leeva na sua região.</h2>
              <p className={styles.lead}>
                Cadastre-se pelo site, envie seus documentos e, depois de aprovado, é só ficar disponível no app para receber
                corridas perto de você.
              </p>
              <a href={CADASTRO_ENTREGADOR} className={`${styles.btn} ${styles.btnVerde}`}>
                Quero ser entregador
              </a>
            </div>
            <ul className={styles.vantagens}>
              <li className={styles.revela} data-revela>
                <h3 className={styles.h3}>Valor antes de aceitar</h3>
                <p>Você vê quanto vai ganhar e a distância antes de dizer sim.</p>
              </li>
              <li className={styles.revela} data-revela>
                <h3 className={styles.h3}>Saque por Pix</h3>
                <p>O que você ganhou fica na carteira do app e você saca por Pix, uma vez por dia.</p>
              </li>
              <li className={styles.revela} data-revela>
                <h3 className={styles.h3}>Você escolhe quando rodar</h3>
                <p>Fica disponível quando quiser. Recusar uma corrida ruim não te prejudica.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className={styles.sec} id="duvidas">
          <div className={styles.wrap}>
            <div className={`${styles.secHead} ${styles.revela}`} data-revela>
              <p className={styles.eyebrow}>Dúvidas comuns</p>
              <h2 className={styles.h2}>Antes de você perguntar</h2>
            </div>
            <div className={styles.faq}>
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.sec} ${styles.final}`}>
          <div className={styles.wrap}>
            <h2 className={styles.h2}>Faça sua primeira entrega hoje.</h2>
            <p className={styles.lead}>Crie a conta, recarregue o crédito e mande o primeiro pedido.</p>
            <Link href="/signup" className={`${styles.btn} ${styles.btnVerde} ${styles.pulsa}`}>
              Criar conta grátis
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.rodape}>
        <div className={styles.wrap}>
          <span>© 2026 Leeva · Logística de entregas para comércios</span>
          <span className={styles.rodapeLinks}>
            <Link href="/login">Entrar</Link>
            <a href={CADASTRO_ENTREGADOR}>Quero ser entregador</a>
            <span>João Pessoa, PB</span>
          </span>
        </div>
      </footer>

      <LandingFx />
    </div>
  );
}
