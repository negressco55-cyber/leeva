'use client';

import { useState } from 'react';
import styles from './landing.module.css';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * "Quanto eu gastaria?" — estimativa do mês com o Leeva vs. o que a loja paga
 * hoje. Honesta: se o volume for alto o bastante pra um fixo compensar, diz.
 */
export default function SavingsCalculator({ perKm, minPayout, fee }: { perKm: number; minPayout: number; fee: number }) {
  const [perDay, setPerDay] = useState(6);
  const [km, setKm] = useState(3);
  const [days, setDays] = useState(26);
  const [today, setToday] = useState(1800);

  const perDelivery = Math.max(km * perKm, minPayout) + fee;
  const month = perDelivery * perDay * days;
  const diff = today - month;

  return (
    <div className={styles.calc}>
      <div className={styles.calcInputs}>
        <h3 className={styles.h3}>Quanto você gastaria no mês</h3>
        <label className={styles.field} htmlFor="calc-per-day">
          Entregas por dia
          <input id="calc-per-day" type="number" min={1} max={500} value={perDay} onChange={(e) => setPerDay(Math.max(0, Number(e.target.value)))} />
        </label>
        <label className={styles.field} htmlFor="calc-km">
          Distância média até o cliente (km)
          <input id="calc-km" type="number" min={0.5} max={30} step={0.5} value={km} onChange={(e) => setKm(Math.max(0, Number(e.target.value)))} />
        </label>
        <label className={styles.field} htmlFor="calc-days">
          Dias abertos no mês
          <input id="calc-days" type="number" min={1} max={31} value={days} onChange={(e) => setDays(Math.max(0, Number(e.target.value)))} />
        </label>
        <label className={styles.field} htmlFor="calc-today">
          Quanto você gasta hoje com entrega por mês (R$)
          <input id="calc-today" type="number" min={0} step={50} value={today} onChange={(e) => setToday(Math.max(0, Number(e.target.value)))} />
        </label>
      </div>

      <div className={styles.calcResult} aria-live="polite">
        <span className={styles.formulaLabel}>Com o Leeva, por mês</span>
        <strong className={styles.bigPrice}>{brl(month)}</strong>
        <span className={styles.formulaNote}>
          {perDay * days} entregas de cerca de {brl(perDelivery)} cada
        </span>
        <p className={styles.calcVerdict}>
          {today <= 0
            ? 'Preencha quanto você gasta hoje para comparar.'
            : diff > 0
              ? `Cerca de ${brl(diff)} a menos por mês do que você gasta hoje.`
              : 'Com esse volume, um entregador fixo pode sair mais barato. Aí o Leeva ajuda no pico e quando ele faltar.'}
        </p>
        <span className={styles.formulaNote}>Estimativa. O valor real de cada entrega aparece antes de você confirmar.</span>
      </div>
    </div>
  );
}
