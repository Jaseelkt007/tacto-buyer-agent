import type { Metadata } from "next";
import Link from "next/link";
import finalRun from "@/data/final-run.json";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "ProcuDeal · Better deals. Less effort.",
  description: "Meet your procurement agent. €2.21M in modeled savings across 28 agreements in the final negotiation arena run.",
};

const euro = (cents: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(cents / 100);
const millions = (cents: number) => `€${(cents / 100_000_000).toFixed(2)}M`;
const reduction = (100 * finalRun.savingsCents / finalRun.openingCents).toFixed(2);
const largestWave = Math.max(...finalRun.waves.map((wave) => wave.savingsCents));

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.canvas}>
        <header className={styles.masthead}>
          <span className={styles.wordmark}>ProcuDeal<span>.</span></span>
          <span className={styles.edition}>FINAL ARENA RUN <span aria-hidden="true">/</span> 25 OCT 2026</span>
        </header>

        <section className={styles.hero} aria-labelledby="intro-heading">
          <div className={styles.intro}>
            <p className={styles.eyebrow}><span className={styles.dot} /> YOUR PROCUREMENT AGENT</p>
            <h1 id="intro-heading">Better deals.<br /><span>Less effort.</span></h1>
            <p className={styles.subtitle}>From supplier insights to negotiated agreements.</p>
            <div className={styles.actions}>
              <Link href="/demo" className={styles.primary}>Start the demo <span aria-hidden="true">↗</span></Link>
              <Link href="/negotiations" className={styles.secondary}>Explore the deals <span aria-hidden="true">→</span></Link>
            </div>
          </div>

          <div className={styles.result}>
            <div className={styles.resultTop}><span>THE FINAL RESULT</span><span aria-hidden="true">↗</span></div>
            <p className={styles.amount}>{millions(finalRun.savingsCents)}</p>
            <h2>in modeled procurement savings</h2>
            <div className={styles.comparison} aria-label="Opening versus agreed total cost for 28 completed deals">
              <div className={styles.barLabel}><span>Opening cost</span><strong>{millions(finalRun.openingCents)}</strong></div>
              <div className={styles.track}><div className={styles.openingBar} /></div>
              <div className={styles.barLabel}><span>Agreed cost</span><strong>{millions(finalRun.agreedCents)}</strong></div>
              <div className={styles.track}><div className={styles.agreedBar} style={{ width: `${100 * finalRun.agreedCents / finalRun.openingCents}%` }} /></div>
            </div>
            <p className={styles.resultNote}>Same 28 cases. Better negotiated terms.</p>
          </div>
        </section>

        <section className={styles.metrics} aria-label="Final run at a glance">
          <div><strong>{reduction}<span>%</span></strong><p>lower total cost</p></div>
          <div><strong>{finalRun.dealCount}<span> / {finalRun.caseCount}</span></strong><p>cases closed with a deal</p></div>
          <div><strong>{String(finalRun.waves.length).padStart(2, "0")}</strong><p>negotiation waves completed</p></div>
        </section>

        <section className={styles.journey} aria-label="How ProcuDeal works">
          <span className={styles.journeyLabel}>FROM INSIGHT TO AGREEMENT</span>
          <ol>
            <li><span>01</span> Understand the supplier</li>
            <li><span>02</span> Negotiate the terms</li>
            <li><span>03</span> Close the deal</li>
          </ol>
        </section>

        <details className={styles.details}>
          <summary>Behind the numbers <span className={styles.detailsHint}>Calculation &amp; wave results</span><span className={styles.plus} aria-hidden="true">+</span></summary>
          <div className={styles.detailBody}>
            <p className={styles.equation}>{euro(finalRun.openingCents)} − {euro(finalRun.agreedCents)} = <strong>{euro(finalRun.savingsCents)} saved</strong></p>
            <div className={styles.waves}>
              {finalRun.waves.map((wave) => (
                <div key={wave.number} className={styles.wave}>
                  <div><span>{String(wave.number).padStart(2, "0")} / {wave.name}</span><strong>{euro(wave.savingsCents)}</strong></div>
                  <div className={styles.waveTrack}><div style={{ width: `${100 * wave.savingsCents / largestWave}%` }} /></div>
                </div>
              ))}
            </div>
            <p className={styles.method}>Opening total cost minus agreed total cost for completed deals, including price, payment, delivery, quality and applicable risk costs. H52 and H72 ended without agreements and are excluded. Source: recorded final arena results.</p>
          </div>
        </details>
        <footer className={styles.footer}><span>Built for the Tacto Negotiation Arena.</span><span>Simulated savings over case-specific horizons; not realized cash or annualized savings.</span></footer>
      </div>
    </main>
  );
}
