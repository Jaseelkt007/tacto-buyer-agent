import type { Metadata } from "next";
import Link from "next/link";
import finalRun from "@/data/final-run.json";
import "./home.css";

export const metadata: Metadata = {
  title: "ProcuDeal · Every Move, A Reason",
  description: "Meet your procurement agent. €2.21M in modeled savings across 28 agreements in the final negotiation arena run.",
};

const euro = (cents: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(cents / 100);
const millions = (cents: number) => `€${(cents / 100_000_000).toFixed(2)}M`;
const reduction = (100 * finalRun.savingsCents / finalRun.openingCents).toFixed(2);
const largestWave = Math.max(...finalRun.waves.map((wave) => wave.savingsCents));

export default function Home() {
  return (
    <main className="home-page">
      <div className="home-canvas">
        <header className="home-masthead">
          <span className="home-wordmark">ProcuDeal<span>.</span></span>
          <span className="home-edition">FINAL ARENA RUN <span aria-hidden="true">/</span> 25 OCT 2026</span>
        </header>

        <section className="home-hero" aria-labelledby="intro-heading">
          <div className="home-intro">
            <p className="home-eyebrow"><span className="home-dot" /> YOUR PROCUREMENT AGENT</p>
            <h1 id="intro-heading">Every Move,<br /><span>A Reason.</span></h1>
            <p className="home-subtitle">From supplier insights to negotiated agreements.</p>
            <div className="home-actions">
              <Link href="/demo" className="home-primary">Start the demo <span aria-hidden="true">↗</span></Link>
              <Link href="/negotiations" className="home-secondary">Explore the deals <span aria-hidden="true">→</span></Link>
            </div>
          </div>

          <div className="home-result">
            <div className="home-resultTop"><span>THE FINAL RESULT</span><span aria-hidden="true">↗</span></div>
            <p className="home-amount">{millions(finalRun.savingsCents)}</p>
            <h2>in modeled procurement savings</h2>
            <div className="home-comparison" aria-label="Opening versus agreed total cost for 28 completed deals">
              <div className="home-barLabel"><span>Opening cost</span><strong>{millions(finalRun.openingCents)}</strong></div>
              <div className="home-track"><div className="home-openingBar" /></div>
              <div className="home-barLabel"><span>Agreed cost</span><strong>{millions(finalRun.agreedCents)}</strong></div>
              <div className="home-track"><div className="home-agreedBar" style={{ width: `${100 * finalRun.agreedCents / finalRun.openingCents}%` }} /></div>
            </div>
            <p className="home-resultNote">Same 28 cases. Better negotiated terms.</p>
          </div>
        </section>

        <section className="home-metrics" aria-label="Final run at a glance">
          <div><strong>{reduction}<span>%</span></strong><p>lower total cost</p></div>
          <div><strong>{finalRun.dealCount}<span> / {finalRun.caseCount}</span></strong><p>cases closed with a deal</p></div>
          <div><strong>{String(finalRun.waves.length).padStart(2, "0")}</strong><p>negotiation waves completed</p></div>
        </section>

        <section className="home-journey" aria-label="How ProcuDeal works">
          <span className="home-journeyLabel">FROM INSIGHT TO AGREEMENT</span>
          <ol>
            <li><span>01</span> Understand the supplier</li>
            <li><span>02</span> Negotiate the terms</li>
            <li><span>03</span> Close the deal</li>
          </ol>
        </section>

        <details className="home-details">
          <summary>Behind the numbers <span className="home-detailsHint">Calculation &amp; wave results</span><span className="home-plus" aria-hidden="true">+</span></summary>
          <div className="home-detailBody">
            <p className="home-equation">{euro(finalRun.openingCents)} − {euro(finalRun.agreedCents)} = <strong>{euro(finalRun.savingsCents)} saved</strong></p>
            <div className="home-waves">
              {finalRun.waves.map((wave) => (
                <div key={wave.number} className="home-wave">
                  <div><span>{String(wave.number).padStart(2, "0")} / {wave.name}</span><strong>{euro(wave.savingsCents)}</strong></div>
                  <div className="home-waveTrack"><div style={{ width: `${100 * wave.savingsCents / largestWave}%` }} /></div>
                </div>
              ))}
            </div>
            <p className="home-method">Opening total cost minus agreed total cost for completed deals, including price, payment, delivery, quality and applicable risk costs. H52 and H72 ended without agreements and are excluded. Source: recorded final arena results.</p>
          </div>
        </details>
        <footer className="home-footer"><span>Built for the Tacto Negotiation Arena.</span><span>Simulated savings over case-specific horizons; not realized cash or annualized savings.</span></footer>
      </div>
    </main>
  );
}
